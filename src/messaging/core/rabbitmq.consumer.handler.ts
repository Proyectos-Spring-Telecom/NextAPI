import { Channel, ConsumeMessage } from 'amqplib';
import { Logger } from '@nestjs/common';
import {
  extractEventId,
  getRetryCount,
  nextRetryHeaders,
} from './rabbitmq-retry.util';
import {
  isPermanentIngestError,
  isRetryableIngestError,
} from './ingest-errors.util';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';
import { isDbUnavailableError } from './db-errors.util';
import { DbAvailabilityGate } from './db-availability.gate';

export interface ConsumerHandlerOptions {
  logger: Logger;
  metrics: RabbitMqMetricsService;
  channel: Channel;
  exchange: string;
  dlx: string;
  dlqRoutingKey: string;
  label: string;
  maxRetries: number;
  dbSemaphore: { acquire(): Promise<void>; release(): void };
  /** Sin compuerta, MySQL caído se trata como error transitorio normal. */
  dbGate?: DbAvailabilityGate;
  /**
   * Máximo que un mensaje espera en memoria a que vuelva MySQL; después se
   * devuelve a la cola (nack con requeue) para no rebasar el consumer_timeout
   * de RabbitMQ (30 min por defecto).
   */
  dbHoldMaxMs?: number;
  /** El canal se cerró mientras se esperaba a MySQL: soltar el mensaje. */
  isChannelClosed?: () => boolean;
}

export async function handleConsumerMessage(
  msg: ConsumeMessage,
  options: ConsumerHandlerOptions,
  handler: () => Promise<void>,
): Promise<void> {
  const {
    logger,
    metrics,
    channel,
    exchange,
    dlx,
    dlqRoutingKey,
    label,
    maxRetries,
    dbSemaphore,
    dbGate,
    dbHoldMaxMs,
    isChannelClosed,
  } = options;
  const eventId = extractEventId(msg);
  const routingKey = msg.fields.routingKey;

  const holdStarted = Date.now();
  let error: unknown;
  for (;;) {
    await dbGate?.whenOpen();
    if (isChannelClosed?.()) {
      return; // sin confirmar: el broker lo reentrega al reconectar
    }
    await dbSemaphore.acquire();
    error = undefined;
    try {
      await handler();
    } catch (e) {
      error = e;
    } finally {
      dbSemaphore.release();
    }

    if (error === undefined) {
      dbGate?.recordAvailable();
      metrics.recordSuccess(label);
      channel.ack(msg);
      logger.debug(
        `${label} ok eventId=${eventId ?? 'n/a'} routingKey=${routingKey}`,
      );
      return;
    }

    // MySQL caído/reiniciando: no es culpa del mensaje. Se queda sin confirmar
    // y se vuelve a intentar cuando la compuerta abra, sin gastar reintentos.
    if (!dbGate || !isDbUnavailableError(error)) {
      break;
    }
    dbGate.recordUnavailable((error as Error)?.message ?? 'unknown');
    if (Date.now() - holdStarted >= (dbHoldMaxMs ?? 5 * 60_000)) {
      channel.nack(msg, false, true);
      return;
    }
  }

  metrics.recordFailure(label);
  const retryCount = getRetryCount(msg);
  const permanent = isPermanentIngestError(error);
  const retryable = isRetryableIngestError(error);
  const exhausted = retryCount >= maxRetries;

  if (permanent || exhausted || !retryable) {
    metrics.recordDlq(label);
    const reason = (error as Error)?.message ?? 'unknown';
    logger.error(
      `${label} → DLQ eventId=${eventId ?? 'n/a'} intento=${retryCount}/${maxRetries} permanente=${permanent}: ${reason}`,
    );
    channel.publish(dlx, dlqRoutingKey, msg.content, {
      contentType: msg.properties.contentType,
      contentEncoding: msg.properties.contentEncoding,
      deliveryMode: msg.properties.deliveryMode ?? 2,
      messageId: msg.properties.messageId,
      headers: {
        ...(msg.properties.headers ?? {}),
        'x-death-reason': reason,
        'x-original-routing-key': routingKey,
        'x-retry-count': retryCount,
      },
    });
    channel.ack(msg);
    return;
  }

  const nextRetry = retryCount + 1;
  logger.warn(
    `${label} reintento ${nextRetry}/${maxRetries} eventId=${eventId ?? 'n/a'}: ${(error as Error)?.message}`,
  );

  channel.publish(exchange, routingKey, msg.content, {
    contentType: msg.properties.contentType,
    contentEncoding: msg.properties.contentEncoding,
    deliveryMode: msg.properties.deliveryMode ?? 2,
    messageId: msg.properties.messageId,
    headers: nextRetryHeaders(msg),
  });
  channel.ack(msg);
}

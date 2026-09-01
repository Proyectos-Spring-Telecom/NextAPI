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
  } = options;
  const eventId = extractEventId(msg);
  const routingKey = msg.fields.routingKey;

  await dbSemaphore.acquire();
  try {
    await handler();
    metrics.recordSuccess(label);
    channel.ack(msg);
    logger.log(
      `${label} ok eventId=${eventId ?? 'n/a'} routingKey=${routingKey}`,
    );
  } catch (error) {
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
  } finally {
    dbSemaphore.release();
  }
}

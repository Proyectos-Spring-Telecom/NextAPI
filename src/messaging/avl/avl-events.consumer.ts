import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMqMetricsService } from '../core/rabbitmq-metrics.service';
import { QUEUE_LABEL } from '../core/rabbitmq-queue-labels';
import { JimiEventsConsumer } from '../jimi/jimi-events.consumer';
import { Jt808EventsConsumer } from '../jt808/jt808-events.consumer';

export type AvlExpectedKind = 'position' | 'alarm';

const AVL_QUEUE_LABEL: Record<AvlExpectedKind, string> = {
  position: QUEUE_LABEL.avlEvents,
  alarm: QUEUE_LABEL.avlAlarms,
};

/**
 * Colas compartidas `telemetry.avl.events` / `telemetry.avl.alarms`.
 * Enruta por `protocol` al consumidor existente (sin lógica de negocio propia).
 * Errores con "incoherente"/"inválido" → permanentes (DLQ sin reintentos).
 */
@Injectable()
export class AvlEventsConsumer {
  constructor(
    private readonly jt808: Jt808EventsConsumer,
    private readonly jimi: JimiEventsConsumer,
    private readonly metrics: RabbitMqMetricsService,
  ) {}

  async consume(
    msg: ConsumeMessage,
    expectedKind: AvlExpectedKind,
  ): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const headers = msg.properties.headers ?? {};

    let body: Record<string, unknown> | null = null;
    const fromBody = (field: string): unknown => {
      body ??= JSON.parse(msg.content.toString('utf8')) as Record<
        string,
        unknown
      >;
      return body?.[field];
    };

    const protocol = headerString(headers.protocol) ?? fromBody('protocol');
    const kind = headerString(headers.kind) ?? fromBody('kind');

    if (kind !== expectedKind) {
      throw new Error(
        `kind=${String(kind)} incoherente con cola avl (${routingKey})`,
      );
    }

    if (protocol === 'jt808') {
      await this.jt808.consume(msg);
    } else if (protocol === 'jimi') {
      await this.jimi.consume(msg);
    } else {
      throw new Error(
        `protocol=${String(protocol)} inválido para cola avl (${routingKey})`,
      );
    }

    const deviceId = headerString(headers.deviceId) ?? fromBody('deviceId');
    this.metrics.recordProtocol(
      AVL_QUEUE_LABEL[expectedKind],
      protocol,
      deviceId != null ? String(deviceId) : null,
    );
  }
}

function headerString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const text = (Buffer.isBuffer(value) ? value.toString('utf8') : String(value))
    .trim();
  return text || undefined;
}

import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { JimiEventsConsumer } from '../jimi/jimi-events.consumer';
import { Jt808EventsConsumer } from '../jt808/jt808-events.consumer';

export type AvlExpectedKind = 'position' | 'alarm';

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
      return;
    }
    if (protocol === 'jimi') {
      await this.jimi.consume(msg);
      return;
    }

    throw new Error(
      `protocol=${String(protocol)} inválido para cola avl (${routingKey})`,
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

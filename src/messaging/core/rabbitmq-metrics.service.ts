import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type ProtocolMetrics = {
  processed: number;
  lastMessageAt: string | null;
  lastDeviceId: string | null;
};

type LabelActivity = {
  lastMessageAt: string | null;
  lastFailureAt: string | null;
  lastDlqAt: string | null;
};

/**
 * Contadores en memoria: se reinician cuando el servicio arranca.
 * `counters` alimenta GET /health/rabbitmq (no agregar campos ahí);
 * `activity` y `protocols` solo los usa GET /health/rabbitmq/queues.
 */
@Injectable()
export class RabbitMqMetricsService {
  private readonly startedAt = new Date().toISOString();
  private connected = false;
  private lastMessageAt: string | null = null;
  private lastReconnectAt: string | null = null;
  private reconnectAttempts = 0;
  private readonly counters = new Map<
    string,
    { processed: number; failed: number; dlq: number; duplicate: number }
  >();
  private readonly activity = new Map<string, LabelActivity>();
  private readonly protocols = new Map<string, Map<string, ProtocolMetrics>>();

  markConnected() {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.lastReconnectAt = new Date().toISOString();
  }

  markDisconnected() {
    this.connected = false;
  }

  incrementReconnectAttempt() {
    this.reconnectAttempts += 1;
  }

  recordSuccess(label: string) {
    this.lastMessageAt = new Date().toISOString();
    this.touchActivity(label, 'lastMessageAt', this.lastMessageAt);
    const row = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    row.processed += 1;
    this.counters.set(label, row);
  }

  recordDuplicate(label: string) {
    this.lastMessageAt = new Date().toISOString();
    this.touchActivity(label, 'lastMessageAt', this.lastMessageAt);
    const row = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    row.duplicate += 1;
    this.counters.set(label, row);
  }

  recordFailure(label: string) {
    this.touchActivity(label, 'lastFailureAt', new Date().toISOString());
    const row = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    row.failed += 1;
    this.counters.set(label, row);
  }

  recordDlq(label: string) {
    this.touchActivity(label, 'lastDlqAt', new Date().toISOString());
    const row = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    row.dlq += 1;
    this.counters.set(label, row);
  }

  /** Mensaje procesado sin error, desglosado por protocolo del gateway (jt808 / jimi). */
  recordProtocol(label: string, protocol: string, deviceId?: string | null) {
    const byProtocol =
      this.protocols.get(label) ?? new Map<string, ProtocolMetrics>();
    const row = byProtocol.get(protocol) ?? {
      processed: 0,
      lastMessageAt: null,
      lastDeviceId: null,
    };
    row.processed += 1;
    row.lastMessageAt = new Date().toISOString();
    if (deviceId) {
      row.lastDeviceId = deviceId;
    }
    byProtocol.set(protocol, row);
    this.protocols.set(label, byProtocol);
  }

  getStartedAt(): string {
    return this.startedAt;
  }

  getLabelMetrics(label: string) {
    const counters = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    const activity = this.activity.get(label) ?? {
      lastMessageAt: null,
      lastFailureAt: null,
      lastDlqAt: null,
    };
    const byProtocol = this.protocols.get(label);
    return {
      ...counters,
      ...activity,
      byProtocol: byProtocol
        ? Object.fromEntries(
            [...byProtocol.entries()].map(([k, v]) => [k, { ...v }]),
          )
        : null,
    };
  }

  getConsumerState() {
    return {
      connected: this.connected,
      lastMessageAt: this.lastMessageAt,
      lastReconnectAt: this.lastReconnectAt,
      reconnectAttempts: this.reconnectAttempts,
      queues: Object.fromEntries(this.counters),
    };
  }

  getSnapshot(dataSource: DataSource) {
    const pool = (dataSource.driver as { pool?: { _allConnections?: unknown[]; _freeConnections?: unknown[] } })
      ?.pool;
    const all = pool?._allConnections?.length ?? null;
    const free = pool?._freeConnections?.length ?? null;

    return {
      ...this.getConsumerState(),
      dbPool: {
        total: all,
        free,
        inUse: all != null && free != null ? all - free : null,
      },
    };
  }

  private touchActivity(label: string, field: keyof LabelActivity, at: string) {
    const row = this.activity.get(label) ?? {
      lastMessageAt: null,
      lastFailureAt: null,
      lastDlqAt: null,
    };
    row[field] = at;
    this.activity.set(label, row);
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RabbitMqMetricsService {
  private connected = false;
  private lastMessageAt: string | null = null;
  private lastReconnectAt: string | null = null;
  private reconnectAttempts = 0;
  private readonly counters = new Map<
    string,
    { processed: number; failed: number; dlq: number; duplicate: number }
  >();

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
    const row = this.counters.get(label) ?? {
      processed: 0,
      failed: 0,
      dlq: 0,
      duplicate: 0,
    };
    row.dlq += 1;
    this.counters.set(label, row);
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
}

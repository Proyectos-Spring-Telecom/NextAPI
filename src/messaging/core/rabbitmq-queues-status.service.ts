import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readRabbitMqConfig } from './rabbitmq.config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';
import {
  BrokerQueueResult,
  buildQueueDescriptors,
  evaluateQueuesStatus,
} from './rabbitmq-queue-status.util';

@Injectable()
export class RabbitMqQueuesStatusService {
  constructor(
    private readonly config: ConfigService,
    private readonly metrics: RabbitMqMetricsService,
    private readonly connection: RabbitMqConnectionService,
  ) {}

  async getStatus() {
    const cfg = readRabbitMqConfig(this.config);
    const idleWarnSeconds =
      Number(this.config.get('QUEUE_IDLE_WARN_SECONDS') ?? 900) || 900;
    const descriptors = buildQueueDescriptors(cfg);
    const startedAt = this.metrics.getStartedAt();

    let connected = cfg.enabled && this.metrics.getConsumerState().connected;
    let brokerResults = new Map<string, BrokerQueueResult>();
    if (connected) {
      brokerResults = await this.connection.getQueueStats(
        descriptors.map((d) => d.queue),
      );
      if ([...brokerResults.values()].some((r) => r.error === 'disconnected')) {
        connected = false;
      }
    }

    const now = Date.now();
    const { status, queues } = evaluateQueuesStatus({
      enabled: cfg.enabled,
      connected,
      now,
      startedAt,
      idleWarnSeconds,
      queues: descriptors.map((descriptor) => ({
        descriptor,
        broker: brokerResults.get(descriptor.queue) ?? {
          broker: null,
          error: 'disconnected',
        },
        metrics: descriptor.label
          ? this.metrics.getLabelMetrics(descriptor.label)
          : null,
      })),
    });

    return {
      status,
      checkedAt: new Date(now).toISOString(),
      connected,
      uptimeSeconds: Math.max(
        0,
        Math.floor((now - new Date(startedAt).getTime()) / 1000),
      ),
      queues,
    };
  }
}

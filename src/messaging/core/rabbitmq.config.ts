import { ConfigService } from '@nestjs/config';

export interface RabbitMqQueueDefinition {
  queue: string;
  bindings: string[];
  prefetch: number;
  dlqRoutingKey: string;
}

export interface RabbitMqRuntimeConfig {
  enabled: boolean;
  amqpUrl: string;
  exchange: string;
  dlx: string;
  heartbeat: number;
  maxRetries: number;
  reconnectMaxDelayMs: number;
  watchdogMinutes: number;
  maxConcurrentDb: number;
  axpro: {
    events: RabbitMqQueueDefinition;
    heartbeats: RabbitMqQueueDefinition;
    dlq: string;
  };
  jt808: {
    events: RabbitMqQueueDefinition;
    media: RabbitMqQueueDefinition;
    dlq: string;
  };
}

function dlqArgs(dlx: string, failedRoutingKey: string) {
  return {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': dlx,
      'x-dead-letter-routing-key': failedRoutingKey,
    },
  };
}

export { dlqArgs };

function prefetch(
  config: ConfigService,
  specificKey: string,
  fallback: number,
): number {
  const global = Number(config.get('RABBITMQ_PREFETCH') ?? 0);
  const specific = Number(config.get(specificKey) ?? 0);
  if (specific > 0) {
    return specific;
  }
  if (global > 0) {
    return global;
  }
  return fallback;
}

export function readRabbitMqConfig(config: ConfigService): RabbitMqRuntimeConfig {
  const host = config.get<string>('RABBITMQ_HOST') ?? '127.0.0.1';
  const port = config.get<number>('RABBITMQ_PORT') ?? 5672;
  const user = encodeURIComponent(
    config.get<string>('RABBITMQ_USERNAME') ?? 'backend',
  );
  const pass = encodeURIComponent(config.get<string>('RABBITMQ_PASSWORD') ?? '');
  const vhost = encodeURIComponent(config.get<string>('RABBITMQ_VHOST') ?? '/');

  const exchange = config.get<string>('RABBITMQ_EXCHANGE') ?? 'telemetry';
  const dlx = config.get<string>('RABBITMQ_DLX') ?? 'telemetry.dlx';
  const defaultPrefetch = prefetch(config, '_', 10);

  const heartbeat = Number(config.get('RABBITMQ_HEARTBEAT') ?? 60) || 60;

  return {
    enabled:
      String(config.get('RABBITMQ_ENABLED') ?? 'false').toLowerCase() ===
      'true',
    amqpUrl: `amqp://${user}:${pass}@${host}:${port}/${vhost}?heartbeat=${heartbeat}`,
    exchange,
    dlx,
    heartbeat,
    maxRetries: Number(config.get('RABBITMQ_MAX_RETRIES') ?? 3) || 3,
    reconnectMaxDelayMs:
      Number(config.get('RABBITMQ_RECONNECT_MAX_DELAY') ?? 30000) || 30000,
    watchdogMinutes:
      Number(config.get('CONSUMER_WATCHDOG_MINUTES') ?? 15) || 15,
    maxConcurrentDb:
      Number(config.get('RABBITMQ_MAX_CONCURRENT_DB') ?? 5) || 5,
    axpro: {
      events: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AXPRO_EVENTS') ??
          'telemetry.axpro.events',
        bindings: ['axpro.event'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_EVENTS', defaultPrefetch),
        dlqRoutingKey: 'telemetry.axpro.failed',
      },
      heartbeats: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AXPRO_HEARTBEATS') ??
          'telemetry.axpro.heartbeats',
        bindings: ['axpro.heartbeat'],
        prefetch: prefetch(
          config,
          'RABBITMQ_PREFETCH_HEARTBEATS',
          defaultPrefetch,
        ),
        dlqRoutingKey: 'telemetry.axpro.failed',
      },
      dlq:
        config.get<string>('RABBITMQ_QUEUE_AXPRO_DLQ') ?? 'telemetry.axpro.dlq',
    },
    jt808: {
      events: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_JT808_EVENTS') ??
          'telemetry.jt808.events',
        bindings: ['jt808.position', 'jt808.alarm.*'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_JT808', defaultPrefetch),
        dlqRoutingKey: 'telemetry.jt808.failed',
      },
      media: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_JT808_MEDIA') ??
          'telemetry.jt808.media',
        bindings: ['jt808.multimedia.photo'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_JT808', defaultPrefetch),
        dlqRoutingKey: 'telemetry.jt808.failed',
      },
      dlq:
        config.get<string>('RABBITMQ_QUEUE_JT808_DLQ') ?? 'telemetry.jt808.dlq',
    },
  };
}

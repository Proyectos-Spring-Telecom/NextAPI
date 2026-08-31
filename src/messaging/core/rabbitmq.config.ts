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

  return {
    enabled:
      String(config.get('RABBITMQ_ENABLED') ?? 'false').toLowerCase() ===
      'true',
    amqpUrl: `amqp://${user}:${pass}@${host}:${port}/${vhost}`,
    exchange,
    dlx,
    axpro: {
      events: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AXPRO_EVENTS') ??
          'telemetry.axpro.events',
        bindings: ['axpro.event'],
        prefetch: Number(config.get('RABBITMQ_PREFETCH_EVENTS') ?? 10) || 10,
        dlqRoutingKey: 'telemetry.axpro.failed',
      },
      heartbeats: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AXPRO_HEARTBEATS') ??
          'telemetry.axpro.heartbeats',
        bindings: ['axpro.heartbeat'],
        prefetch:
          Number(config.get('RABBITMQ_PREFETCH_HEARTBEATS') ?? 50) || 50,
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
        prefetch: Number(config.get('RABBITMQ_PREFETCH_JT808') ?? 20) || 20,
        dlqRoutingKey: 'telemetry.jt808.failed',
      },
      media: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_JT808_MEDIA') ??
          'telemetry.jt808.media',
        bindings: ['jt808.multimedia.photo'],
        prefetch: Number(config.get('RABBITMQ_PREFETCH_JT808') ?? 20) || 20,
        dlqRoutingKey: 'telemetry.jt808.failed',
      },
      dlq:
        config.get<string>('RABBITMQ_QUEUE_JT808_DLQ') ?? 'telemetry.jt808.dlq',
    },
  };
}

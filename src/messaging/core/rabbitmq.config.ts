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
  /** Tope de la espera creciente entre intentos cuando MySQL no responde. */
  dbRetryMaxDelayMs: number;
  /** Máximo que un mensaje espera en memoria a MySQL antes de devolverse a la cola. */
  dbHoldMaxMs: number;
  axpro: {
    events: RabbitMqQueueDefinition;
    heartbeats: RabbitMqQueueDefinition;
    dlq: string;
  };
  avl: {
    events: RabbitMqQueueDefinition;
    alarms: RabbitMqQueueDefinition;
    dlq: string;
  };
  /** Reintento con espera (colas de retraso que regresan al exchange principal). */
  retry: { exchange: string; esperasMs: number[] };
  /** Comandos de Next a los equipos (docs/motor-activos.md §8). */
  comandos: {
    /**
     * Exchange topic de salida: `<protocolo>.cmd` → cola `telemetry.commands.<protocolo>` que
     * consume el socket. Prefijo `telemetry` porque los usuarios del broker solo operan ahí.
     */
    exchange: string;
    protocolos: string[];
    /** Confirmaciones del socket (`<protocolo>.cmd.ack` en el exchange de telemetría). */
    acks: RabbitMqQueueDefinition;
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

/**
 * AVL: los mensajes de un mismo equipo se procesan en orden, uno a la vez
 * (OrdenPorEquipo); con 50 en vuelo, el lote atrasado de un equipo no frena a
 * los demás. La concurrencia a MySQL la sigue limitando RABBITMQ_MAX_CONCURRENT_DB.
 */
const PREFETCH_AVL = 50;

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
    dbRetryMaxDelayMs:
      Number(config.get('RABBITMQ_DB_RETRY_MAX_DELAY_MS') ?? 30000) || 30000,
    dbHoldMaxMs:
      Number(config.get('RABBITMQ_DB_HOLD_MAX_MS') ?? 300000) || 300000,
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
    avl: {
      events: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AVL_EVENTS') ??
          'telemetry.avl.events',
        bindings: ['jt808.position', 'jimi.position', 'fa100s.position'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_AVL', PREFETCH_AVL),
        dlqRoutingKey: 'telemetry.avl.failed',
      },
      alarms: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_AVL_ALARMS') ??
          'telemetry.avl.alarms',
        bindings: ['jt808.alarm.*', 'jimi.alarm.*', 'fa100s.alarm.*'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_AVL', PREFETCH_AVL),
        dlqRoutingKey: 'telemetry.avl.failed',
      },
      dlq:
        config.get<string>('RABBITMQ_QUEUE_AVL_DLQ') ?? 'telemetry.avl.dlq',
    },
    retry: {
      exchange: config.get<string>('RABBITMQ_EXCHANGE_RETRY') ?? 'telemetry.retry',
      esperasMs: String(config.get('RABBITMQ_RETRY_DELAYS_MS') ?? '5000,30000,120000')
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x) && x > 0),
    },
    comandos: {
      exchange: config.get<string>('RABBITMQ_EXCHANGE_COMANDOS') ?? 'telemetry.commands',
      protocolos: ['fa100s'],
      acks: {
        queue:
          config.get<string>('RABBITMQ_QUEUE_COMANDOS_ACKS') ??
          'telemetry.commands.acks',
        bindings: ['*.cmd.ack'],
        prefetch: prefetch(config, 'RABBITMQ_PREFETCH_COMANDOS', defaultPrefetch),
        dlqRoutingKey: 'telemetry.commands.failed',
      },
      dlq:
        config.get<string>('RABBITMQ_QUEUE_COMANDOS_DLQ') ??
        'telemetry.commands.dlq',
    },
  };
}

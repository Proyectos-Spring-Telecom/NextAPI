import { RabbitMqRuntimeConfig } from './rabbitmq.config';
import { ProtocolMetrics } from './rabbitmq-metrics.service';
import { QUEUE_LABEL } from './rabbitmq-queue-labels';

export type QueueRole = 'work' | 'dlq';
export type QueueState = 'ok' | 'idle' | 'degraded' | 'down' | 'disabled';
export type QueuesGlobalStatus = 'ok' | 'degraded' | 'down' | 'disabled';

export type BrokerQueueStats = { messages: number; consumers: number };

export type BrokerQueueResult = {
  broker: BrokerQueueStats | null;
  error: 'missing' | 'timeout' | 'error' | 'disconnected' | null;
};

export type QueueDescriptor = {
  queue: string;
  group: 'axpro' | 'avl';
  label: string | null;
  role: QueueRole;
  /** Cola con tráfico continuo esperado: el silencio prolongado se marca "idle". */
  expectsTraffic: boolean;
  /** Avisar cuando un protocolo (jt808/jimi) deja de reportar. */
  watchProtocols: boolean;
};

export type QueueLabelMetrics = {
  processed: number;
  failed: number;
  dlq: number;
  duplicate: number;
  lastMessageAt: string | null;
  lastFailureAt: string | null;
  lastDlqAt: string | null;
  byProtocol: Record<string, ProtocolMetrics> | null;
};

export type WorkQueueStatus = {
  queue: string;
  group: QueueDescriptor['group'];
  label: string;
  broker: BrokerQueueStats | null;
  processed: number;
  failed: number;
  dlq: number;
  duplicate: number;
  lastMessageAt: string | null;
  secondsSinceLastMessage: number | null;
  byProtocol: Record<string, ProtocolMetrics> | null;
  state: QueueState;
  warnings: string[];
};

export type DlqQueueStatus = {
  queue: string;
  group: QueueDescriptor['group'];
  label: null;
  broker: BrokerQueueStats | null;
  state: QueueState;
  warnings: string[];
};

export type QueueStatusItem = WorkQueueStatus | DlqQueueStatus;

export type EvaluateQueuesInput = {
  enabled: boolean;
  connected: boolean;
  now: number;
  startedAt: string;
  idleWarnSeconds: number;
  backlogThreshold?: number;
  queues: Array<{
    descriptor: QueueDescriptor;
    broker: BrokerQueueResult;
    metrics: QueueLabelMetrics | null;
  }>;
};

const DEFAULT_BACKLOG_THRESHOLD = 100;

const SEVERITY: Record<QueueState, number> = {
  disabled: 0,
  ok: 1,
  idle: 2,
  degraded: 3,
  down: 4,
};

const EMPTY_METRICS: QueueLabelMetrics = {
  processed: 0,
  failed: 0,
  dlq: 0,
  duplicate: 0,
  lastMessageAt: null,
  lastFailureAt: null,
  lastDlqAt: null,
  byProtocol: null,
};

export function buildQueueDescriptors(
  cfg: RabbitMqRuntimeConfig,
): QueueDescriptor[] {
  return [
    {
      queue: cfg.axpro.events.queue,
      group: 'axpro',
      label: QUEUE_LABEL.axproEvents,
      role: 'work',
      expectsTraffic: false,
      watchProtocols: false,
    },
    {
      queue: cfg.axpro.heartbeats.queue,
      group: 'axpro',
      label: QUEUE_LABEL.axproHeartbeats,
      role: 'work',
      expectsTraffic: true,
      watchProtocols: false,
    },
    {
      queue: cfg.axpro.dlq,
      group: 'axpro',
      label: null,
      role: 'dlq',
      expectsTraffic: false,
      watchProtocols: false,
    },
    {
      queue: cfg.avl.events.queue,
      group: 'avl',
      label: QUEUE_LABEL.avlEvents,
      role: 'work',
      expectsTraffic: true,
      watchProtocols: true,
    },
    {
      queue: cfg.avl.alarms.queue,
      group: 'avl',
      label: QUEUE_LABEL.avlAlarms,
      role: 'work',
      expectsTraffic: false,
      watchProtocols: false,
    },
    {
      queue: cfg.avl.dlq,
      group: 'avl',
      label: null,
      role: 'dlq',
      expectsTraffic: false,
      watchProtocols: false,
    },
  ];
}

/**
 * Reglas:
 * - Cola de trabajo: down si consumers=0 (o no existe); degraded si messages>100
 *   o hubo fallos/DLQ dentro de la ventana `idleWarnSeconds`; idle si no llega
 *   nada en `idleWarnSeconds` (solo colas con `expectsTraffic`); ok en otro caso.
 * - DLQ: degraded si messages>0; ok en otro caso.
 * - Global: disabled | down (sin conexión o alguna cola de trabajo down) |
 *   degraded (alguna degraded/idle) | ok.
 */
export function evaluateQueuesStatus(input: EvaluateQueuesInput): {
  status: QueuesGlobalStatus;
  queues: QueueStatusItem[];
} {
  const queues = input.queues.map(({ descriptor, broker, metrics }) =>
    descriptor.role === 'dlq'
      ? evaluateDlq(descriptor, broker, input)
      : evaluateWorkQueue(descriptor, broker, metrics ?? EMPTY_METRICS, input),
  );

  if (!input.enabled) {
    return { status: 'disabled', queues };
  }
  const workDown = queues.some(
    (q) => q.label !== null && q.state === 'down',
  );
  if (!input.connected || workDown) {
    return { status: 'down', queues };
  }
  const degraded = queues.some(
    (q) => q.state === 'degraded' || q.state === 'idle' || q.state === 'down',
  );
  return { status: degraded ? 'degraded' : 'ok', queues };
}

function evaluateWorkQueue(
  descriptor: QueueDescriptor,
  result: BrokerQueueResult,
  metrics: QueueLabelMetrics,
  input: EvaluateQueuesInput,
): WorkQueueStatus {
  const secondsSinceLastMessage = secondsSince(metrics.lastMessageAt, input.now);
  const base = {
    queue: descriptor.queue,
    group: descriptor.group,
    label: descriptor.label ?? '',
    broker: result.broker,
    processed: metrics.processed,
    failed: metrics.failed,
    dlq: metrics.dlq,
    duplicate: metrics.duplicate,
    lastMessageAt: metrics.lastMessageAt,
    secondsSinceLastMessage,
    byProtocol:
      descriptor.group === 'avl' ? (metrics.byProtocol ?? {}) : null,
  };

  if (!input.enabled) {
    return { ...base, state: 'disabled', warnings: [] };
  }

  const warnings: string[] = [];
  let state: QueueState = 'ok';
  const raise = (next: QueueState) => {
    if (SEVERITY[next] > SEVERITY[state]) {
      state = next;
    }
  };

  if (!input.connected || result.error === 'disconnected') {
    raise('down');
    warnings.push('sin conexión a RabbitMQ');
  } else if (!result.broker) {
    if (result.error === 'missing') {
      raise('down');
      warnings.push('cola no existe');
    } else {
      raise('degraded');
      warnings.push(brokerErrorWarning(result.error));
    }
  } else {
    if (result.broker.consumers === 0) {
      raise('down');
      warnings.push('sin consumidores');
    }
    const backlog = input.backlogThreshold ?? DEFAULT_BACKLOG_THRESHOLD;
    if (result.broker.messages > backlog) {
      raise('degraded');
      warnings.push(`${result.broker.messages} mensajes acumulados`);
    }
  }

  const windowMin = minutes(input.idleWarnSeconds);
  if (withinWindow(metrics.lastDlqAt, input)) {
    raise('degraded');
    warnings.push(`mensajes enviados a DLQ en los últimos ${windowMin} min`);
  }
  if (withinWindow(metrics.lastFailureAt, input)) {
    raise('degraded');
    warnings.push(`fallos de procesamiento en los últimos ${windowMin} min`);
  }

  if (descriptor.expectsTraffic) {
    const silent =
      secondsSinceLastMessage ?? secondsSince(input.startedAt, input.now) ?? 0;
    if (silent > input.idleWarnSeconds) {
      raise('idle');
      warnings.push(
        metrics.lastMessageAt
          ? `sin mensajes desde hace ${minutes(silent)} min`
          : `sin mensajes desde el arranque (${minutes(silent)} min)`,
      );
    }
  }

  if (descriptor.watchProtocols && metrics.byProtocol) {
    for (const [protocol, row] of Object.entries(metrics.byProtocol)) {
      const silent = secondsSince(row.lastMessageAt, input.now);
      if (silent != null && silent > input.idleWarnSeconds) {
        warnings.push(`${protocol} sin mensajes desde hace ${minutes(silent)} min`);
      }
    }
  }

  return { ...base, state, warnings };
}

function evaluateDlq(
  descriptor: QueueDescriptor,
  result: BrokerQueueResult,
  input: EvaluateQueuesInput,
): DlqQueueStatus {
  const base = {
    queue: descriptor.queue,
    group: descriptor.group,
    label: null,
    broker: result.broker,
  };

  if (!input.enabled) {
    return { ...base, state: 'disabled', warnings: [] };
  }
  if (!input.connected || result.error === 'disconnected') {
    return { ...base, state: 'down', warnings: ['sin conexión a RabbitMQ'] };
  }
  if (!result.broker) {
    return {
      ...base,
      state: 'degraded',
      warnings: [
        result.error === 'missing'
          ? 'cola no existe'
          : brokerErrorWarning(result.error),
      ],
    };
  }
  if (result.broker.messages > 0) {
    return {
      ...base,
      state: 'degraded',
      warnings: [`${result.broker.messages} mensajes con error; revisar`],
    };
  }
  return { ...base, state: 'ok', warnings: [] };
}

function brokerErrorWarning(error: BrokerQueueResult['error']): string {
  return error === 'timeout'
    ? 'sin respuesta del broker (timeout)'
    : 'no se pudo consultar la cola';
}

function withinWindow(iso: string | null, input: EvaluateQueuesInput): boolean {
  const seconds = secondsSince(iso, input.now);
  return seconds != null && seconds <= input.idleWarnSeconds;
}

function secondsSince(iso: string | null, now: number): number | null {
  if (!iso) {
    return null;
  }
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) {
    return null;
  }
  return Math.max(0, Math.floor((now - at) / 1000));
}

function minutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

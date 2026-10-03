import {
  BrokerQueueResult,
  EvaluateQueuesInput,
  evaluateQueuesStatus,
  QueueDescriptor,
  QueueLabelMetrics,
  WorkQueueStatus,
} from './rabbitmq-queue-status.util';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

const AVL_EVENTS: QueueDescriptor = {
  queue: 'telemetry.avl.events',
  group: 'avl',
  label: 'avl:events',
  role: 'work',
  expectsTraffic: true,
  watchProtocols: true,
};
const AVL_ALARMS: QueueDescriptor = {
  queue: 'telemetry.avl.alarms',
  group: 'avl',
  label: 'avl:alarms',
  role: 'work',
  expectsTraffic: false,
  watchProtocols: false,
};
const AVL_DLQ: QueueDescriptor = {
  queue: 'telemetry.avl.dlq',
  group: 'avl',
  label: null,
  role: 'dlq',
  expectsTraffic: false,
  watchProtocols: false,
};

const healthy = (messages = 0, consumers = 1): BrokerQueueResult => ({
  broker: { messages, consumers },
  error: null,
});

const metrics = (over: Partial<QueueLabelMetrics> = {}): QueueLabelMetrics => ({
  processed: 10,
  failed: 0,
  dlq: 0,
  duplicate: 0,
  lastMessageAt: ago(5),
  lastFailureAt: null,
  lastDlqAt: null,
  byProtocol: null,
  ...over,
});

function input(
  queues: EvaluateQueuesInput['queues'],
  over: Partial<EvaluateQueuesInput> = {},
): EvaluateQueuesInput {
  return {
    enabled: true,
    connected: true,
    now: NOW,
    startedAt: ago(3600),
    idleWarnSeconds: 900,
    queues,
    ...over,
  };
}

function allOk(): EvaluateQueuesInput['queues'] {
  return [
    { descriptor: AVL_EVENTS, broker: healthy(), metrics: metrics() },
    { descriptor: AVL_ALARMS, broker: healthy(), metrics: metrics({ lastMessageAt: null }) },
    { descriptor: AVL_DLQ, broker: healthy(0, 0), metrics: null },
  ];
}

describe('evaluateQueuesStatus', () => {
  it('todo ok → status ok y cada cola ok sin warnings', () => {
    const result = evaluateQueuesStatus(input(allOk()));

    expect(result.status).toBe('ok');
    expect(result.queues.map((q) => q.state)).toEqual(['ok', 'ok', 'ok']);
    expect(result.queues.every((q) => q.warnings.length === 0)).toBe(true);
    const events = result.queues[0] as WorkQueueStatus;
    expect(events.secondsSinceLastMessage).toBe(5);
    expect(events.byProtocol).toEqual({});
  });

  it('sin consumidor en cola de trabajo → down y status down', () => {
    const queues = allOk();
    queues[1] = { descriptor: AVL_ALARMS, broker: healthy(0, 0), metrics: metrics() };

    const result = evaluateQueuesStatus(input(queues));

    expect(result.queues[1].state).toBe('down');
    expect(result.queues[1].warnings).toContain('sin consumidores');
    expect(result.status).toBe('down');
  });

  it('mensajes acumulados > 100 → degraded', () => {
    const queues = allOk();
    queues[0] = { descriptor: AVL_EVENTS, broker: healthy(250), metrics: metrics() };

    const result = evaluateQueuesStatus(input(queues));

    expect(result.queues[0].state).toBe('degraded');
    expect(result.queues[0].warnings).toContain('250 mensajes acumulados');
    expect(result.status).toBe('degraded');
  });

  it('DLQ reciente o fallos recientes → degraded; si son viejos no', () => {
    const recent = evaluateQueuesStatus(
      input([
        {
          descriptor: AVL_ALARMS,
          broker: healthy(),
          metrics: metrics({ dlq: 1, lastDlqAt: ago(60), failed: 2, lastFailureAt: ago(60) }),
        },
      ]),
    );
    expect(recent.queues[0].state).toBe('degraded');
    expect(recent.queues[0].warnings).toHaveLength(2);

    const old = evaluateQueuesStatus(
      input([
        {
          descriptor: AVL_ALARMS,
          broker: healthy(),
          metrics: metrics({ dlq: 1, lastDlqAt: ago(3000) }),
        },
      ]),
    );
    expect(old.queues[0].state).toBe('ok');
  });

  it('avl.events sin mensajes > QUEUE_IDLE_WARN_SECONDS → idle y status degraded', () => {
    const queues = allOk();
    queues[0] = {
      descriptor: AVL_EVENTS,
      broker: healthy(),
      metrics: metrics({ lastMessageAt: ago(1200) }),
    };

    const result = evaluateQueuesStatus(input(queues));

    expect(result.queues[0].state).toBe('idle');
    expect(result.queues[0].warnings).toContain('sin mensajes desde hace 20 min');
    expect(result.status).toBe('degraded');
  });

  it('avl.alarms sin mensajes no se marca idle', () => {
    const result = evaluateQueuesStatus(
      input([
        { descriptor: AVL_ALARMS, broker: healthy(), metrics: metrics({ lastMessageAt: ago(99999) }) },
      ]),
    );
    expect(result.queues[0].state).toBe('ok');
  });

  it('protocolo que dejó de reportar → warning sin cambiar el state', () => {
    const result = evaluateQueuesStatus(
      input([
        {
          descriptor: AVL_EVENTS,
          broker: healthy(),
          metrics: metrics({
            byProtocol: {
              jt808: { processed: 50, lastMessageAt: ago(5), lastDeviceId: 'T-01' },
              jimi: { processed: 3, lastMessageAt: ago(1800), lastDeviceId: '8690' },
            },
          }),
        },
      ]),
    );

    expect(result.queues[0].state).toBe('ok');
    expect(result.queues[0].warnings).toEqual(['jimi sin mensajes desde hace 30 min']);
  });

  it('DLQ con mensajes → degraded con warning de revisión', () => {
    const queues = allOk();
    queues[2] = { descriptor: AVL_DLQ, broker: healthy(7, 0), metrics: null };

    const result = evaluateQueuesStatus(input(queues));

    expect(result.queues[2]).toEqual({
      queue: 'telemetry.avl.dlq',
      group: 'avl',
      label: null,
      broker: { messages: 7, consumers: 0 },
      state: 'degraded',
      warnings: ['7 mensajes con error; revisar'],
    });
    expect(result.status).toBe('degraded');
  });

  it('cola inexistente → broker null, down y "cola no existe"', () => {
    const result = evaluateQueuesStatus(
      input([{ descriptor: AVL_EVENTS, broker: { broker: null, error: 'missing' }, metrics: metrics() }]),
    );
    expect(result.queues[0].broker).toBeNull();
    expect(result.queues[0].state).toBe('down');
    expect(result.queues[0].warnings).toContain('cola no existe');
    expect(result.status).toBe('down');
  });

  it('desconectado → todas down, broker null y status down', () => {
    const disconnected: BrokerQueueResult = { broker: null, error: 'disconnected' };
    const result = evaluateQueuesStatus(
      input(
        [
          { descriptor: AVL_EVENTS, broker: disconnected, metrics: metrics() },
          { descriptor: AVL_DLQ, broker: disconnected, metrics: null },
        ],
        { connected: false },
      ),
    );

    expect(result.status).toBe('down');
    expect(result.queues.every((q) => q.state === 'down' && q.broker === null)).toBe(true);
  });

  it('RABBITMQ_ENABLED=false → status disabled', () => {
    const disconnected: BrokerQueueResult = { broker: null, error: 'disconnected' };
    const result = evaluateQueuesStatus(
      input([{ descriptor: AVL_EVENTS, broker: disconnected, metrics: null }], {
        enabled: false,
        connected: false,
      }),
    );
    expect(result.status).toBe('disabled');
    expect(result.queues[0].state).toBe('disabled');
  });
});

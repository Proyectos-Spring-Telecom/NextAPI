import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

describe('RabbitMqMetricsService', () => {
  let metrics: RabbitMqMetricsService;

  beforeEach(() => {
    metrics = new RabbitMqMetricsService();
  });

  it('recordProtocol acumula por label + protocolo con último deviceId', () => {
    metrics.recordProtocol('avl:events', 'jt808', 'T-01');
    metrics.recordProtocol('avl:events', 'jt808', 'T-02');
    metrics.recordProtocol('avl:events', 'jimi', '8690');
    metrics.recordProtocol('avl:alarms', 'jimi', '8691');

    const events = metrics.getLabelMetrics('avl:events').byProtocol!;
    expect(events.jt808).toMatchObject({ processed: 2, lastDeviceId: 'T-02' });
    expect(events.jimi).toMatchObject({ processed: 1, lastDeviceId: '8690' });
    expect(events.jt808.lastMessageAt).toEqual(expect.any(String));

    expect(metrics.getLabelMetrics('avl:alarms').byProtocol).toEqual({
      jimi: expect.objectContaining({ processed: 1, lastDeviceId: '8691' }),
    });
  });

  it('recordProtocol sin deviceId conserva el último conocido', () => {
    metrics.recordProtocol('avl:events', 'jimi', '8690');
    metrics.recordProtocol('avl:events', 'jimi', null);

    expect(metrics.getLabelMetrics('avl:events').byProtocol!.jimi).toMatchObject({
      processed: 2,
      lastDeviceId: '8690',
    });
  });

  it('label sin protocolos → byProtocol null', () => {
    metrics.recordSuccess('axpro:event');
    expect(metrics.getLabelMetrics('axpro:event').byProtocol).toBeNull();
  });

  it('registra lastMessageAt/lastFailureAt/lastDlqAt por label', () => {
    metrics.recordSuccess('avl:events');
    metrics.recordFailure('avl:alarms');
    metrics.recordDlq('avl:alarms');

    expect(metrics.getLabelMetrics('avl:events').lastMessageAt).toEqual(expect.any(String));
    expect(metrics.getLabelMetrics('avl:alarms')).toMatchObject({
      failed: 1,
      dlq: 1,
      lastMessageAt: null,
      lastFailureAt: expect.any(String),
      lastDlqAt: expect.any(String),
    });
  });

  it('getConsumerState mantiene la forma de /health/rabbitmq (solo contadores)', () => {
    metrics.recordSuccess('avl:events');
    metrics.recordProtocol('avl:events', 'jt808', 'T-01');

    expect(metrics.getConsumerState().queues).toEqual({
      'avl:events': { processed: 1, failed: 0, dlq: 0, duplicate: 0 },
    });
  });
});

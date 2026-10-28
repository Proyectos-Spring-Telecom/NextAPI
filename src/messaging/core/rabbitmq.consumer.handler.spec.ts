import { Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { QueryFailedError } from 'typeorm';
import { DbAvailabilityGate } from './db-availability.gate';
import { DbConcurrencyLimiter } from './db-concurrency.util';
import { handleConsumerMessage, ConsumerHandlerOptions } from './rabbitmq.consumer.handler';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as Logger;

const msg = (headers: Record<string, unknown> = {}): ConsumeMessage =>
  ({
    content: Buffer.from('{}'),
    fields: { routingKey: 'jimi.position' },
    properties: { messageId: 'ev-1', headers },
  }) as unknown as ConsumeMessage;

const shutdown = () =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('Server shutdown in progress'), {
    code: 'ER_SERVER_SHUTDOWN',
    errno: 1053,
  }));

function setup(extra: Partial<ConsumerHandlerOptions> = {}) {
  const channel = { ack: jest.fn(), nack: jest.fn(), publish: jest.fn() };
  const metrics = new RabbitMqMetricsService();
  const gate = new DbAvailabilityGate(logger, { initialDelayMs: 5, maxDelayMs: 20 });
  const options: ConsumerHandlerOptions = {
    logger,
    metrics,
    channel: channel as never,
    exchange: 'telemetry',
    dlx: 'telemetry.dlx',
    dlqRoutingKey: 'avl.dlq',
    label: 'avl:events',
    maxRetries: 3,
    dbSemaphore: new DbConcurrencyLimiter(5),
    dbGate: gate,
    ...extra,
  };
  return { channel, gate, options };
}

describe('handleConsumerMessage con MySQL no disponible', () => {
  it('espera a que MySQL vuelva sin gastar reintentos ni ir a la DLQ', async () => {
    const { channel, gate, options } = setup();
    // MySQL abajo 4 intentos (más que maxRetries=3) y luego vuelve.
    let calls = 0;
    const handler = jest.fn(async () => {
      calls += 1;
      if (calls <= 4) throw shutdown();
    });

    await handleConsumerMessage(msg(), options, handler);

    expect(handler).toHaveBeenCalledTimes(5);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.publish).not.toHaveBeenCalled(); // ni DLQ ni reintento
    expect(gate.isOpen).toBe(true);
  });

  it('pasado dbHoldMaxMs devuelve el mensaje a la cola (nack con requeue)', async () => {
    const { channel, options } = setup({ dbHoldMaxMs: 15 });
    await handleConsumerMessage(msg(), options, async () => {
      throw shutdown();
    });
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('si el canal se cierra durante la espera, suelta el mensaje sin confirmar', async () => {
    let closed = false;
    const { channel, options } = setup({ isChannelClosed: () => closed });
    await handleConsumerMessage(msg(), options, async () => {
      closed = true;
      throw shutdown();
    });
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('sin compuerta conserva el comportamiento anterior (reintento republicando)', async () => {
    const { channel, options } = setup({ dbGate: undefined });
    await handleConsumerMessage(msg(), options, async () => {
      throw shutdown();
    });
    expect(channel.publish).toHaveBeenCalledWith(
      'telemetry',
      'jimi.position',
      expect.any(Buffer),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-retry-count': 1 }) }),
    );
  });

  it('un error del mensaje sigue yendo a la DLQ al instante', async () => {
    const { channel, options } = setup();
    await handleConsumerMessage(msg(), options, async () => {
      throw new Error('kind=x incoherente con cola avl');
    });
    expect(channel.publish).toHaveBeenCalledWith('telemetry.dlx', 'avl.dlq', expect.any(Buffer), expect.anything());
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});

describe('DbAvailabilityGate', () => {
  it('espera creciente con tope y un aviso por caída', async () => {
    const warn = jest.fn();
    const log = jest.fn();
    const gate = new DbAvailabilityGate({ warn, log } as unknown as Logger, { initialDelayMs: 4, maxDelayMs: 10 });
    gate.recordUnavailable('x');
    gate.recordUnavailable('x'); // misma ventana: no cuenta doble
    expect(gate.isOpen).toBe(false);
    const t0 = Date.now();
    await gate.whenOpen();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(3);
    gate.recordUnavailable('x'); // 8 ms
    await gate.whenOpen();
    gate.recordUnavailable('x'); // tope 10 ms
    await gate.whenOpen();
    expect(warn).toHaveBeenCalledTimes(1);
    gate.recordAvailable();
    expect(gate.isOpen).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('MySQL disponible de nuevo'));
  });
});

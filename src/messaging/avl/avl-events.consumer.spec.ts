import { ConsumeMessage } from 'amqplib';
import { isPermanentIngestError } from '../core/ingest-errors.util';
import { AvlEventsConsumer } from './avl-events.consumer';

jest.mock('../jt808/jt808-events.consumer', () => ({
  Jt808EventsConsumer: class {},
}));
jest.mock('../jimi/jimi-events.consumer', () => ({
  JimiEventsConsumer: class {},
}));

function buildMsg(opts: {
  routingKey: string;
  headers?: Record<string, unknown>;
  body: Record<string, unknown>;
}): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(opts.body), 'utf8'),
    fields: { routingKey: opts.routingKey },
    properties: { headers: opts.headers },
  } as unknown as ConsumeMessage;
}

describe('AvlEventsConsumer', () => {
  const jt808 = { consume: jest.fn().mockResolvedValue(undefined) };
  const jimi = { consume: jest.fn().mockResolvedValue(undefined) };
  let consumer: AvlEventsConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new AvlEventsConsumer(jt808 as never, jimi as never);
  });

  it('jt808 position en cola events → delega solo a jt808', async () => {
    const msg = buildMsg({
      routingKey: 'jt808.position',
      headers: { protocol: 'jt808', kind: 'position' },
      body: { protocol: 'jt808', kind: 'position' },
    });

    await consumer.consume(msg, 'position');

    expect(jt808.consume).toHaveBeenCalledTimes(1);
    expect(jt808.consume).toHaveBeenCalledWith(msg);
    expect(jimi.consume).not.toHaveBeenCalled();
  });

  it('jimi alarm en cola alarms → delega a jimi', async () => {
    const msg = buildMsg({
      routingKey: 'jimi.alarm.basica',
      headers: { protocol: 'jimi', kind: 'alarm' },
      body: { protocol: 'jimi', kind: 'alarm' },
    });

    await consumer.consume(msg, 'alarm');

    expect(jimi.consume).toHaveBeenCalledTimes(1);
    expect(jimi.consume).toHaveBeenCalledWith(msg);
    expect(jt808.consume).not.toHaveBeenCalled();
  });

  it('usa el header protocol aunque el body diga otra cosa', async () => {
    const msg = buildMsg({
      routingKey: 'jimi.position',
      headers: { protocol: 'jimi', kind: 'position' },
      body: { protocol: 'jt808', kind: 'position' },
    });

    await consumer.consume(msg, 'position');

    expect(jimi.consume).toHaveBeenCalledTimes(1);
    expect(jt808.consume).not.toHaveBeenCalled();
  });

  it('sin headers toma protocol y kind del body', async () => {
    const msg = buildMsg({
      routingKey: 'jimi.position',
      body: { protocol: 'jimi', kind: 'position' },
    });

    await consumer.consume(msg, 'position');

    expect(jimi.consume).toHaveBeenCalledTimes(1);
    expect(jt808.consume).not.toHaveBeenCalled();
  });

  it('acepta header protocol como Buffer', async () => {
    const msg = buildMsg({
      routingKey: 'jt808.position',
      headers: { protocol: Buffer.from('jt808'), kind: 'position' },
      body: { protocol: 'jt808', kind: 'position' },
    });

    await consumer.consume(msg, 'position');

    expect(jt808.consume).toHaveBeenCalledTimes(1);
  });

  it('kind=alarm en cola events → error permanente "incoherente"', async () => {
    const msg = buildMsg({
      routingKey: 'jt808.alarm.dsm',
      headers: { protocol: 'jt808', kind: 'alarm' },
      body: { protocol: 'jt808', kind: 'alarm' },
    });

    const error = await consumer.consume(msg, 'position').catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('incoherente');
    expect(isPermanentIngestError(error)).toBe(true);
    expect(jt808.consume).not.toHaveBeenCalled();
    expect(jimi.consume).not.toHaveBeenCalled();
  });

  it('protocol=axpro → error permanente "inválido"', async () => {
    const msg = buildMsg({
      routingKey: 'jt808.position',
      headers: { protocol: 'axpro', kind: 'position' },
      body: { protocol: 'axpro', kind: 'position' },
    });

    const error = await consumer.consume(msg, 'position').catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('inválido');
    expect(isPermanentIngestError(error)).toBe(true);
    expect(jt808.consume).not.toHaveBeenCalled();
    expect(jimi.consume).not.toHaveBeenCalled();
  });
});

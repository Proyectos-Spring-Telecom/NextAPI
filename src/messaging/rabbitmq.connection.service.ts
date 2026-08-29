import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { AxproIngestService } from './axpro-ingest.service';
import {
  assertAxproEnvelope,
  isPermanentIngestError,
  parseAxproEnvelope,
} from './axpro-envelope.mapper';
import {
  AxproEventPayload,
  AxproHeartbeatPayload,
} from './axpro-envelope.types';

@Injectable()
export class RabbitMqConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private eventsChannel?: Channel;
  private heartbeatsChannel?: Channel;

  constructor(
    private readonly config: ConfigService,
    private readonly axproIngest: AxproIngestService,
  ) {}

  async onModuleInit() {
    const enabled =
      String(this.config.get('RABBITMQ_ENABLED') ?? 'false').toLowerCase() ===
      'true';
    if (!enabled) {
      this.logger.log('RabbitMQ deshabilitado (RABBITMQ_ENABLED != true)');
      return;
    }

    try {
      await this.connectAndConsume();
    } catch (error) {
      this.logger.error(
        `No se pudo iniciar RabbitMQ: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
    }
  }

  async onModuleDestroy() {
    await this.eventsChannel?.close().catch(() => undefined);
    await this.heartbeatsChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private buildAmqpUrl(): string {
    const host = this.config.get<string>('RABBITMQ_HOST') ?? '127.0.0.1';
    const port = this.config.get<number>('RABBITMQ_PORT') ?? 5672;
    const user = encodeURIComponent(
      this.config.get<string>('RABBITMQ_USERNAME') ?? 'backend',
    );
    const pass = encodeURIComponent(
      this.config.get<string>('RABBITMQ_PASSWORD') ?? '',
    );
    const vhostRaw = this.config.get<string>('RABBITMQ_VHOST') ?? '/';
    const vhost = encodeURIComponent(vhostRaw);
    return `amqp://${user}:${pass}@${host}:${port}/${vhost}`;
  }

  private async connectAndConsume() {
    const exchange = this.config.get<string>('RABBITMQ_EXCHANGE') ?? 'telemetry';
    const dlx = this.config.get<string>('RABBITMQ_DLX') ?? 'telemetry.dlx';
    const queueEvents =
      this.config.get<string>('RABBITMQ_QUEUE_AXPRO_EVENTS') ??
      'telemetry.axpro.events';
    const queueHeartbeats =
      this.config.get<string>('RABBITMQ_QUEUE_AXPRO_HEARTBEATS') ??
      'telemetry.axpro.heartbeats';
    const queueDlq =
      this.config.get<string>('RABBITMQ_QUEUE_AXPRO_DLQ') ??
      'telemetry.axpro.dlq';
    const prefetchEvents =
      Number(this.config.get('RABBITMQ_PREFETCH_EVENTS') ?? 10) || 10;
    const prefetchHeartbeats =
      Number(this.config.get('RABBITMQ_PREFETCH_HEARTBEATS') ?? 50) || 50;

    this.connection = await amqp.connect(this.buildAmqpUrl());
    this.connection.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    const dlqArgs = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlx,
        'x-dead-letter-routing-key': 'telemetry.axpro.failed',
      },
    };

    this.eventsChannel = await this.connection.createChannel();
    this.heartbeatsChannel = await this.connection.createChannel();

    await this.eventsChannel.assertExchange(exchange, 'topic', { durable: true });
    await this.eventsChannel.assertExchange(dlx, 'topic', { durable: true });
    await this.heartbeatsChannel.assertExchange(exchange, 'topic', {
      durable: true,
    });
    await this.heartbeatsChannel.assertExchange(dlx, 'topic', { durable: true });

    await this.eventsChannel.assertQueue(queueEvents, dlqArgs);
    await this.eventsChannel.bindQueue(queueEvents, exchange, 'axpro.event');
    await this.heartbeatsChannel.assertQueue(queueHeartbeats, dlqArgs);
    await this.heartbeatsChannel.bindQueue(
      queueHeartbeats,
      exchange,
      'axpro.heartbeat',
    );
    await this.eventsChannel.assertQueue(queueDlq, { durable: true });
    await this.eventsChannel.bindQueue(
      queueDlq,
      dlx,
      'telemetry.axpro.failed',
    );

    await this.eventsChannel.prefetch(prefetchEvents);
    await this.heartbeatsChannel.prefetch(prefetchHeartbeats);

    await this.eventsChannel.consume(
      queueEvents,
      (msg) => void this.onEventMessage(msg),
      { noAck: false },
    );
    await this.heartbeatsChannel.consume(
      queueHeartbeats,
      (msg) => void this.onHeartbeatMessage(msg),
      { noAck: false },
    );

    this.logger.log(
      `RabbitMQ AX PRO activo: ${queueEvents}, ${queueHeartbeats}`,
    );
  }

  private async onEventMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.eventsChannel) {
      return;
    }
    await this.handleMessage(msg, this.eventsChannel, 'event', async (raw) => {
      const envelope = parseAxproEnvelope(raw);
      assertAxproEnvelope(envelope);
      if (envelope.kind !== 'event') {
        throw new Error('kind incoherente con cola axpro.event');
      }
      await this.axproIngest.handleEvent(
        envelope as typeof envelope & { payload: AxproEventPayload },
      );
    });
  }

  private async onHeartbeatMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.heartbeatsChannel) {
      return;
    }
    await this.handleMessage(
      msg,
      this.heartbeatsChannel,
      'heartbeat',
      async (raw) => {
        const envelope = parseAxproEnvelope(raw);
        assertAxproEnvelope(envelope);
        if (envelope.kind !== 'heartbeat') {
          throw new Error('kind incoherente con cola axpro.heartbeat');
        }
        await this.axproIngest.handleHeartbeat(
          envelope as typeof envelope & { payload: AxproHeartbeatPayload },
        );
      },
    );
  }

  private async handleMessage(
    msg: ConsumeMessage,
    channel: Channel,
    expectedKind: string,
    handler: (raw: string) => Promise<void>,
  ) {
    const raw = msg.content.toString('utf8');
    try {
      await handler(raw);
      channel.ack(msg);
    } catch (error) {
      const permanent = isPermanentIngestError(error);
      this.logger.error(
        `axpro:${expectedKind} falló (requeue=${!permanent}): ${(error as Error)?.message}`,
      );
      channel.nack(msg, false, !permanent);
    }
  }
}

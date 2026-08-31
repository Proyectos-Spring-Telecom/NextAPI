import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { AxproEventsConsumer } from '../axpro/axpro-events.consumer';
import { AxproHeartbeatsConsumer } from '../axpro/axpro-heartbeats.consumer';
import { Jt808EventsConsumer } from '../jt808/jt808-events.consumer';
import { Jt808PhotoConsumer } from '../jt808/jt808-photo.consumer';
import { dlqArgs, readRabbitMqConfig } from './rabbitmq.config';
import { handleConsumerMessage } from './rabbitmq.consumer.handler';

@Injectable()
export class RabbitMqConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private channels: Channel[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly axproEventsConsumer: AxproEventsConsumer,
    private readonly axproHeartbeatsConsumer: AxproHeartbeatsConsumer,
    private readonly jt808EventsConsumer: Jt808EventsConsumer,
    private readonly jt808PhotoConsumer: Jt808PhotoConsumer,
  ) {}

  async onModuleInit() {
    const cfg = readRabbitMqConfig(this.config);
    if (!cfg.enabled) {
      this.logger.log('RabbitMQ deshabilitado (RABBITMQ_ENABLED != true)');
      return;
    }

    try {
      await this.connectAndConsume(cfg);
    } catch (error) {
      this.logger.error(
        `No se pudo iniciar RabbitMQ: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
    }
  }

  async onModuleDestroy() {
    for (const ch of this.channels) {
      await ch.close().catch(() => undefined);
    }
    await this.connection?.close().catch(() => undefined);
  }

  private async connectAndConsume(
    cfg: ReturnType<typeof readRabbitMqConfig>,
  ) {
    this.connection = await amqp.connect(cfg.amqpUrl);
    this.connection.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    const axproEventsCh = await this.connection.createChannel();
    const axproHbCh = await this.connection.createChannel();
    const jt808EventsCh = await this.connection.createChannel();
    const jt808MediaCh = await this.connection.createChannel();
    this.channels = [axproEventsCh, axproHbCh, jt808EventsCh, jt808MediaCh];

    for (const ch of this.channels) {
      await ch.assertExchange(cfg.exchange, 'topic', { durable: true });
      await ch.assertExchange(cfg.dlx, 'topic', { durable: true });
    }

    await this.setupQueue(axproEventsCh, cfg.exchange, cfg.dlx, cfg.axpro.events);
    await this.setupQueue(
      axproHbCh,
      cfg.exchange,
      cfg.dlx,
      cfg.axpro.heartbeats,
    );
    await axproEventsCh.assertQueue(cfg.axpro.dlq, { durable: true });
    await axproEventsCh.bindQueue(cfg.axpro.dlq, cfg.dlx, 'telemetry.axpro.failed');

    await this.setupQueue(jt808EventsCh, cfg.exchange, cfg.dlx, cfg.jt808.events);
    await this.setupQueue(jt808MediaCh, cfg.exchange, cfg.dlx, cfg.jt808.media);
    await jt808EventsCh.assertQueue(cfg.jt808.dlq, { durable: true });
    await jt808EventsCh.bindQueue(
      cfg.jt808.dlq,
      cfg.dlx,
      'telemetry.jt808.failed',
    );

    await axproEventsCh.consume(
      cfg.axpro.events.queue,
      (msg) => void this.onMessage(msg, axproEventsCh, 'axpro:event', (m) =>
        this.axproEventsConsumer.consume(m),
      ),
      { noAck: false },
    );
    await axproHbCh.consume(
      cfg.axpro.heartbeats.queue,
      (msg) =>
        void this.onMessage(msg, axproHbCh, 'axpro:heartbeat', (m) =>
          this.axproHeartbeatsConsumer.consume(m),
        ),
      { noAck: false },
    );
    await jt808EventsCh.consume(
      cfg.jt808.events.queue,
      (msg) =>
        void this.onMessage(msg, jt808EventsCh, 'jt808:events', (m) =>
          this.jt808EventsConsumer.consume(m),
        ),
      { noAck: false },
    );
    await jt808MediaCh.consume(
      cfg.jt808.media.queue,
      (msg) =>
        void this.onMessage(msg, jt808MediaCh, 'jt808:media', (m) =>
          this.jt808PhotoConsumer.consume(m),
        ),
      { noAck: false },
    );

    this.logger.log(
      `RabbitMQ activo: AX PRO (${cfg.axpro.events.queue}, ${cfg.axpro.heartbeats.queue}); JT808 (${cfg.jt808.events.queue}, ${cfg.jt808.media.queue})`,
    );
  }

  private async setupQueue(
    channel: Channel,
    exchange: string,
    dlx: string,
    def: {
      queue: string;
      bindings: string[];
      prefetch: number;
      dlqRoutingKey: string;
    },
  ) {
    await channel.assertQueue(
      def.queue,
      dlqArgs(dlx, def.dlqRoutingKey),
    );
    for (const key of def.bindings) {
      await channel.bindQueue(def.queue, exchange, key);
    }
    await channel.prefetch(def.prefetch);
  }

  private async onMessage(
    msg: ConsumeMessage | null,
    channel: Channel,
    label: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
  ) {
    if (!msg) {
      return;
    }
    await handleConsumerMessage(this.logger, msg, channel, label, () =>
      handler(msg),
    );
  }
}

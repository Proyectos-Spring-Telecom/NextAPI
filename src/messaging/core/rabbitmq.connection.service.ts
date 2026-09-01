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
import { DbConcurrencyLimiter } from './db-concurrency.util';
import {
  dlqArgs,
  RabbitMqQueueDefinition,
  RabbitMqRuntimeConfig,
  readRabbitMqConfig,
} from './rabbitmq.config';
import { handleConsumerMessage } from './rabbitmq.consumer.handler';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

type ConsumerRegistration = {
  channel: Channel;
  queue: string;
  label: string;
  queueDef: RabbitMqQueueDefinition;
  handler: (msg: ConsumeMessage) => Promise<void>;
  consumerTag: string;
};

@Injectable()
export class RabbitMqConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private cfg: RabbitMqRuntimeConfig | null = null;
  private connection: ChannelModel | null = null;
  private consumers: ConsumerRegistration[] = [];
  private stopping = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelayMs = 1000;
  private dbLimiter = new DbConcurrencyLimiter(5);

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: RabbitMqMetricsService,
    private readonly axproEventsConsumer: AxproEventsConsumer,
    private readonly axproHeartbeatsConsumer: AxproHeartbeatsConsumer,
    private readonly jt808EventsConsumer: Jt808EventsConsumer,
    private readonly jt808PhotoConsumer: Jt808PhotoConsumer,
  ) {}

  async onModuleInit() {
    this.cfg = readRabbitMqConfig(this.config);
    if (!this.cfg.enabled) {
      this.logger.log('RabbitMQ deshabilitado (RABBITMQ_ENABLED != true)');
      return;
    }

    this.dbLimiter = new DbConcurrencyLimiter(this.cfg.maxConcurrentDb);
    this.startWatchdog();
    void this.connectWithRetry('inicio');
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
    }
    await this.teardown();
  }

  private startWatchdog() {
    const minutes = this.cfg?.watchdogMinutes ?? 15;
    const intervalMs = 60_000;
    this.watchdogTimer = setInterval(() => {
      void this.runWatchdog(minutes);
    }, intervalMs);
  }

  private async runWatchdog(thresholdMinutes: number) {
    if (this.stopping || !this.cfg?.enabled) {
      return;
    }
    const snapshot = this.metrics.getConsumerState();
    if (!snapshot.connected) {
      return;
    }

    const referenceIso = snapshot.lastMessageAt ?? snapshot.lastReconnectAt;
    if (!referenceIso) {
      return;
    }

    const silentMs = Date.now() - new Date(referenceIso).getTime();
    const thresholdMs = thresholdMinutes * 60_000;
    if (silentMs >= thresholdMs) {
      this.logger.warn(
        `Watchdog: sin actividad del consumidor en ${Math.round(silentMs / 60_000)} min — reconexión preventiva`,
      );
      await this.teardown();
      this.scheduleReconnect('watchdog inactividad');
    }
  }

  private scheduleReconnect(reason: string) {
    if (this.stopping || !this.cfg?.enabled) {
      return;
    }

    this.metrics.markDisconnected();
    this.metrics.incrementReconnectAttempt();
    const maxDelay = this.cfg.reconnectMaxDelayMs;
    const delay = Math.min(this.reconnectDelayMs, maxDelay);
    this.logger.warn(
      `Reconexión RabbitMQ en ${delay}ms (intento ${this.metrics.getConsumerState().reconnectAttempts}, motivo: ${reason})`,
    );

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      void this.connectWithRetry(reason);
    }, delay);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, maxDelay);
  }

  private async connectWithRetry(trigger: string) {
    if (this.stopping || !this.cfg) {
      return;
    }

    try {
      await this.teardown();
      await this.connectAndConsume();
      this.reconnectDelayMs = 1000;
      this.metrics.markConnected();
      this.logger.log(`RabbitMQ conectado (${trigger})`);
    } catch (error) {
      this.logger.error(
        `Fallo al conectar RabbitMQ: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      this.scheduleReconnect((error as Error)?.message ?? 'error');
    }
  }

  private async teardown() {
    for (const reg of this.consumers) {
      await reg.channel.cancel(reg.consumerTag).catch(() => undefined);
    }
    const channels = [...new Set(this.consumers.map((c) => c.channel))];
    this.consumers = [];
    for (const ch of channels) {
      await ch.close().catch(() => undefined);
    }
    if (this.connection) {
      await this.connection.close().catch(() => undefined);
      this.connection = null;
    }
    this.metrics.markDisconnected();
  }

  private bindConnectionEvents(conn: ChannelModel) {
    conn.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
      void this.teardown().then(() => this.scheduleReconnect('connection error'));
    });
    conn.on('close', () => {
      if (!this.stopping) {
        this.logger.warn('RabbitMQ connection closed');
        void this.teardown().then(() => this.scheduleReconnect('connection close'));
      }
    });
  }

  private bindChannelEvents(channel: Channel, name: string) {
    channel.on('error', (err) => {
      this.logger.error(`RabbitMQ channel ${name} error: ${err.message}`);
      void this.teardown().then(() => this.scheduleReconnect(`channel ${name} error`));
    });
    channel.on('close', () => {
      if (!this.stopping) {
        this.logger.warn(`RabbitMQ channel ${name} closed`);
        void this.teardown().then(() =>
          this.scheduleReconnect(`channel ${name} close`),
        );
      }
    });
  }

  private async connectAndConsume() {
    const cfg = this.cfg!;
    this.connection = await amqp.connect(cfg.amqpUrl);
    this.bindConnectionEvents(this.connection);

    const axproEventsCh = await this.connection.createChannel();
    const axproHbCh = await this.connection.createChannel();
    const jt808EventsCh = await this.connection.createChannel();
    const jt808MediaCh = await this.connection.createChannel();

    this.bindChannelEvents(axproEventsCh, 'axpro-events');
    this.bindChannelEvents(axproHbCh, 'axpro-heartbeats');
    this.bindChannelEvents(jt808EventsCh, 'jt808-events');
    this.bindChannelEvents(jt808MediaCh, 'jt808-media');

    for (const ch of [axproEventsCh, axproHbCh, jt808EventsCh, jt808MediaCh]) {
      await ch.assertExchange(cfg.exchange, 'topic', { durable: true });
      await ch.assertExchange(cfg.dlx, 'topic', { durable: true });
    }

    await this.setupQueue(axproEventsCh, cfg.exchange, cfg.dlx, cfg.axpro.events);
    await this.setupQueue(axproHbCh, cfg.exchange, cfg.dlx, cfg.axpro.heartbeats);
    await axproEventsCh.assertQueue(cfg.axpro.dlq, { durable: true });
    await axproEventsCh.bindQueue(
      cfg.axpro.dlq,
      cfg.dlx,
      cfg.axpro.events.dlqRoutingKey,
    );

    await this.setupQueue(jt808EventsCh, cfg.exchange, cfg.dlx, cfg.jt808.events);
    await this.setupQueue(jt808MediaCh, cfg.exchange, cfg.dlx, cfg.jt808.media);
    await jt808EventsCh.assertQueue(cfg.jt808.dlq, { durable: true });
    await jt808EventsCh.bindQueue(
      cfg.jt808.dlq,
      cfg.dlx,
      cfg.jt808.events.dlqRoutingKey,
    );

    await this.registerConsumer(
      axproEventsCh,
      cfg.axpro.events,
      'axpro:event',
      (m) => this.axproEventsConsumer.consume(m),
    );
    await this.registerConsumer(
      axproHbCh,
      cfg.axpro.heartbeats,
      'axpro:heartbeat',
      (m) => this.axproHeartbeatsConsumer.consume(m),
    );
    await this.registerConsumer(
      jt808EventsCh,
      cfg.jt808.events,
      'jt808:events',
      (m) => this.jt808EventsConsumer.consume(m),
    );
    await this.registerConsumer(
      jt808MediaCh,
      cfg.jt808.media,
      'jt808:media',
      (m) => this.jt808PhotoConsumer.consume(m),
    );

    this.logger.log(
      `Consumidores activos (prefetch axpro=${cfg.axpro.events.prefetch}/${cfg.axpro.heartbeats.prefetch}, jt808=${cfg.jt808.events.prefetch}, maxDb=${cfg.maxConcurrentDb}, maxRetries=${cfg.maxRetries})`,
    );
  }

  private async registerConsumer(
    channel: Channel,
    queueDef: RabbitMqQueueDefinition,
    label: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
  ) {
    const { consumerTag } = await channel.consume(
      queueDef.queue,
      (msg) => {
        if (!msg) {
          return;
        }
        void this.onMessage(msg, channel, label, queueDef, () => handler(msg));
      },
      { noAck: false },
    );

    this.consumers.push({
      channel,
      queue: queueDef.queue,
      label,
      queueDef,
      handler,
      consumerTag,
    });
  }

  private async setupQueue(
    channel: Channel,
    exchange: string,
    dlx: string,
    def: RabbitMqQueueDefinition,
  ) {
    await channel.assertQueue(def.queue, dlqArgs(dlx, def.dlqRoutingKey));
    for (const key of def.bindings) {
      await channel.bindQueue(def.queue, exchange, key);
    }
    await channel.prefetch(def.prefetch);
  }

  private async onMessage(
    msg: ConsumeMessage,
    channel: Channel,
    label: string,
    queueDef: RabbitMqQueueDefinition,
    handler: () => Promise<void>,
  ) {
    await handleConsumerMessage(msg, {
      logger: this.logger,
      metrics: this.metrics,
      channel,
      exchange: this.cfg!.exchange,
      dlx: this.cfg!.dlx,
      dlqRoutingKey: queueDef.dlqRoutingKey,
      label,
      maxRetries: this.cfg!.maxRetries,
      dbSemaphore: this.dbLimiter,
    }, handler);
  }
}

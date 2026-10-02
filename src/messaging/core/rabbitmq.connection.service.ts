import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { AvlEventsConsumer } from '../avl/avl-events.consumer';
import { AxproEventsConsumer } from '../axpro/axpro-events.consumer';
import { AxproHeartbeatsConsumer } from '../axpro/axpro-heartbeats.consumer';
import { JimiEventsConsumer } from '../jimi/jimi-events.consumer';
import { Jt808EventsConsumer } from '../jt808/jt808-events.consumer';
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
    private readonly jimiEventsConsumer: JimiEventsConsumer,
    private readonly avlEventsConsumer: AvlEventsConsumer,
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
    const avlEventsCh = await this.connection.createChannel();
    const avlAlarmsCh = await this.connection.createChannel();
    const jt808EventsCh = await this.connection.createChannel();
    const jimiEventsCh = await this.connection.createChannel();

    this.bindChannelEvents(axproEventsCh, 'axpro-events');
    this.bindChannelEvents(axproHbCh, 'axpro-heartbeats');
    this.bindChannelEvents(avlEventsCh, 'avl-events');
    this.bindChannelEvents(avlAlarmsCh, 'avl-alarms');
    this.bindChannelEvents(jt808EventsCh, 'jt808-events');
    this.bindChannelEvents(jimiEventsCh, 'jimi-events');

    for (const ch of [
      axproEventsCh,
      axproHbCh,
      avlEventsCh,
      avlAlarmsCh,
      jt808EventsCh,
      jimiEventsCh,
    ]) {
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

    // AVL (JT808 + Jimi): bindings nuevos ANTES de quitar los legacy, para no
    // dejar ventanas en que el exchange descarte jt808.* / jimi.*.
    await this.setupQueue(avlEventsCh, cfg.exchange, cfg.dlx, cfg.avl.events);
    await this.setupQueue(avlAlarmsCh, cfg.exchange, cfg.dlx, cfg.avl.alarms);
    await avlEventsCh.assertQueue(cfg.avl.dlq, { durable: true });
    await avlEventsCh.bindQueue(
      cfg.avl.dlq,
      cfg.dlx,
      cfg.avl.events.dlqRoutingKey,
    );

    // Legacy: se siguen consumiendo para vaciarlas, pero sin bindings al exchange.
    await this.setupQueue(jt808EventsCh, cfg.exchange, cfg.dlx, cfg.jt808.events, {
      bind: false,
    });
    await this.unbindLegacy(jt808EventsCh, cfg.exchange, cfg.jt808.events);
    await jt808EventsCh.assertQueue(cfg.jt808.dlq, { durable: true });
    await jt808EventsCh.bindQueue(
      cfg.jt808.dlq,
      cfg.dlx,
      cfg.jt808.events.dlqRoutingKey,
    );

    await this.setupQueue(jimiEventsCh, cfg.exchange, cfg.dlx, cfg.jimi.events, {
      bind: false,
    });
    await this.unbindLegacy(jimiEventsCh, cfg.exchange, cfg.jimi.events);
    await jimiEventsCh.assertQueue(cfg.jimi.dlq, { durable: true });
    await jimiEventsCh.bindQueue(
      cfg.jimi.dlq,
      cfg.dlx,
      cfg.jimi.events.dlqRoutingKey,
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
      avlEventsCh,
      cfg.avl.events,
      'avl:events',
      (m) => this.avlEventsConsumer.consume(m, 'position'),
    );
    await this.registerConsumer(
      avlAlarmsCh,
      cfg.avl.alarms,
      'avl:alarms',
      (m) => this.avlEventsConsumer.consume(m, 'alarm'),
    );
    await this.registerConsumer(
      jt808EventsCh,
      cfg.jt808.events,
      'jt808:events',
      (m) => this.jt808EventsConsumer.consume(m),
    );
    await this.registerConsumer(
      jimiEventsCh,
      cfg.jimi.events,
      'jimi:events',
      (m) => this.jimiEventsConsumer.consume(m),
    );

    this.logger.log(
      `Consumidores activos (prefetch axpro=${cfg.axpro.events.prefetch}/${cfg.axpro.heartbeats.prefetch}, avl=${cfg.avl.events.prefetch}/${cfg.avl.alarms.prefetch}, jt808(legacy)=${cfg.jt808.events.prefetch}, jimi(legacy)=${cfg.jimi.events.prefetch}, maxDb=${cfg.maxConcurrentDb}, maxRetries=${cfg.maxRetries})`,
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
    opts: { bind: boolean } = { bind: true },
  ) {
    await channel.assertQueue(def.queue, dlqArgs(dlx, def.dlqRoutingKey));
    if (opts.bind) {
      for (const key of def.bindings) {
        await channel.bindQueue(def.queue, exchange, key);
      }
    }
    await channel.prefetch(def.prefetch);
  }

  /** Solo para colas legacy jt808/jimi; nunca para axpro. */
  private async unbindLegacy(
    channel: Channel,
    exchange: string,
    def: RabbitMqQueueDefinition,
  ) {
    for (const key of def.bindings) {
      try {
        await channel.unbindQueue(def.queue, exchange, key);
      } catch (error) {
        this.logger.warn(
          `unbind legacy ${def.queue} <- ${exchange} (${key}) falló: ${(error as Error)?.message}`,
        );
      }
    }
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

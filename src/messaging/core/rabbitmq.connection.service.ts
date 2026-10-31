import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import { ComandosAcksConsumer } from '../comandos/comandos-acks.consumer';
import { AvlEventsConsumer } from '../avl/avl-events.consumer';
import { AxproEventsConsumer } from '../axpro/axpro-events.consumer';
import { AxproHeartbeatsConsumer } from '../axpro/axpro-heartbeats.consumer';
import { DbAvailabilityGate } from './db-availability.gate';
import { DbConcurrencyLimiter } from './db-concurrency.util';
import {
  dlqArgs,
  RabbitMqQueueDefinition,
  RabbitMqRuntimeConfig,
  readRabbitMqConfig,
} from './rabbitmq.config';
import { handleConsumerMessage } from './rabbitmq.consumer.handler';
import { OrdenPorEquipo } from './orden-por-equipo';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';
import { QUEUE_LABEL } from './rabbitmq-queue-labels';
import { BrokerQueueResult } from './rabbitmq-queue-status.util';

type ConsumerRegistration = {
  channel: Channel;
  queue: string;
  label: string;
  queueDef: RabbitMqQueueDefinition;
  handler: (msg: ConsumeMessage) => Promise<void>;
  consumerTag: string;
};

/** `protocolo|deviceId` de los headers (o del cuerpo): la misma llave en posiciones y alarmas. */
export function llaveEquipo(msg: ConsumeMessage): string | null {
  const h = msg.properties.headers ?? {};
  const texto = (v: unknown) => (v == null ? '' : Buffer.isBuffer(v) ? v.toString('utf8') : String(v)).trim();
  let protocolo = texto(h.protocol);
  let deviceId = texto(h.deviceId);
  if (!protocolo || !deviceId) {
    try {
      const body = JSON.parse(msg.content.toString('utf8')) as { protocol?: unknown; deviceId?: unknown };
      protocolo ||= texto(body.protocol);
      deviceId ||= texto(body.deviceId);
    } catch {
      return null;
    }
  }
  return deviceId ? `${protocolo}|${deviceId}` : null;
}

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
  private dbGate = new DbAvailabilityGate(this.logger);
  /** Canales cerrados: un mensaje en espera de MySQL deja de intentar (el broker lo reentrega). */
  private readonly closedChannels = new WeakSet<Channel>();
  private comandosChannel: ConfirmChannel | null = null;
  /** Posiciones y alarmas de un mismo equipo, en orden y una a la vez (ambas colas AVL comparten llaves). */
  private readonly ordenPorEquipo = new OrdenPorEquipo();
  /** Las colas de retraso están declaradas: los reintentos esperan en lugar de ser inmediatos. */
  private retryListo = false;
  private readonly comandosDevueltos = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: RabbitMqMetricsService,
    private readonly axproEventsConsumer: AxproEventsConsumer,
    private readonly axproHeartbeatsConsumer: AxproHeartbeatsConsumer,
    private readonly avlEventsConsumer: AvlEventsConsumer,
    private readonly comandosAcksConsumer: ComandosAcksConsumer,
  ) {}

  async onModuleInit() {
    this.cfg = readRabbitMqConfig(this.config);
    if (!this.cfg.enabled) {
      this.logger.log('RabbitMQ deshabilitado (RABBITMQ_ENABLED != true)');
      return;
    }

    this.dbLimiter = new DbConcurrencyLimiter(this.cfg.maxConcurrentDb);
    this.dbGate = new DbAvailabilityGate(this.logger, {
      maxDelayMs: this.cfg.dbRetryMaxDelayMs,
    });
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

  /**
   * Solo lectura (checkQueue, nunca assertQueue) en un canal temporal propio:
   * los canales de consumo no se tocan. Una cola inexistente (404) cierra el
   * canal en el broker, así que se abre otro para las siguientes.
   */
  async getQueueStats(
    queues: string[],
    timeoutMs = 5000,
  ): Promise<Map<string, BrokerQueueResult>> {
    const results = new Map<string, BrokerQueueResult>();
    const conn = this.connection;
    if (!conn) {
      for (const queue of queues) {
        results.set(queue, { broker: null, error: 'disconnected' });
      }
      return results;
    }

    const opened: Channel[] = [];
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const work = async () => {
      let channel: Channel | null = null;
      for (const queue of queues) {
        if (timedOut) {
          return;
        }
        try {
          if (!channel) {
            const created = await conn.createChannel();
            created.on('error', () => undefined);
            if (timedOut) {
              await created.close().catch(() => undefined);
              return;
            }
            opened.push(created);
            channel = created;
          }
          const { messageCount, consumerCount } =
            await channel.checkQueue(queue);
          if (timedOut) {
            return;
          }
          results.set(queue, {
            broker: { messages: messageCount, consumers: consumerCount },
            error: null,
          });
        } catch (error) {
          if (timedOut) {
            return;
          }
          const missing = (error as { code?: number })?.code === 404;
          results.set(queue, { broker: null, error: missing ? 'missing' : 'error' });
          channel = null;
        }
      }
    };

    try {
      await Promise.race([
        work(),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            timedOut = true;
            resolve();
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      for (const ch of opened) {
        await ch.close().catch(() => undefined);
      }
    }

    for (const queue of queues) {
      if (!results.has(queue)) {
        results.set(queue, { broker: null, error: 'timeout' });
      }
    }
    return results;
  }

  private startWatchdog() {
    const minutes = this.cfg?.watchdogMinutes ?? 15;
    const intervalMs = 60_000;
    this.watchdogTimer = setInterval(() => {
      void this.runWatchdog(minutes);
    }, intervalMs);
  }

  /**
   * Colas de retraso para reintentos: exchange headers `telemetry.retry` y una
   * cola por espera (`telemetry.retry.<ms>`) con TTL; al vencer, el mensaje
   * regresa al exchange principal con su routing key original (sin
   * x-dead-letter-routing-key). Si no se pueden declarar, reintento inmediato.
   */
  private async prepararReintentos(cfg: RabbitMqRuntimeConfig): Promise<boolean> {
    if (!cfg.retry.esperasMs.length || !this.connection) return false;
    // Canal propio: un 403 aquí cierra solo este canal, no la conexión de la ingesta.
    const ch = await this.connection.createChannel();
    ch.on('error', (err: Error) => this.logger.error(`Canal de reintentos: ${err?.message}`));
    try {
      await ch.assertExchange(cfg.retry.exchange, 'headers', { durable: true });
      for (const ms of cfg.retry.esperasMs) {
        const cola = `${cfg.retry.exchange}.${ms}`;
        await ch.assertQueue(cola, {
          durable: true,
          arguments: { 'x-message-ttl': ms, 'x-dead-letter-exchange': cfg.exchange },
        });
        await ch.bindQueue(cola, cfg.retry.exchange, '', { 'x-match': 'all', 'x-retraso': String(ms) });
      }
      this.logger.log(`Reintentos con espera: ${cfg.retry.esperasMs.map((ms) => `${ms / 1000}s`).join(', ')}`);
      return true;
    } catch (error) {
      this.logger.error(`Colas de retraso no disponibles (reintento inmediato): ${(error as Error)?.message}`);
      return false;
    } finally {
      await ch.close().catch(() => undefined);
    }
  }

  /**
   * Canal de comandos (docs/motor-activos.md §8) en sus propios canales: un
   * error aquí (p. ej. 403 por permisos del usuario en el broker) no tumba la
   * conexión ni la ingesta; los comandos se quedan pendientes en la base y se
   * vuelve a intentar en la siguiente reconexión.
   */
  private async prepararComandos(cfg: RabbitMqRuntimeConfig): Promise<void> {
    const conn = this.connection;
    if (!conn) return;
    try {
      const acksCh = await conn.createChannel();
      const pubCh = await conn.createConfirmChannel();
      for (const ch of [acksCh, pubCh]) {
        ch.on('error', (err: Error) => this.logger.error(`Canal de comandos: ${err?.message}`));
        ch.on('close', () => {
          if (this.comandosChannel === pubCh || ch === acksCh) this.comandosChannel = null;
        });
      }
      await acksCh.assertExchange(cfg.comandos.exchange, 'topic', { durable: true });
      for (const protocolo of cfg.comandos.protocolos) {
        const cola = `${cfg.comandos.exchange}.${protocolo}`;
        await acksCh.assertQueue(cola, { durable: true });
        await acksCh.bindQueue(cola, cfg.comandos.exchange, `${protocolo}.cmd`);
      }
      await this.setupQueue(acksCh, cfg.exchange, cfg.dlx, cfg.comandos.acks);
      await acksCh.assertQueue(cfg.comandos.dlq, { durable: true });
      await acksCh.bindQueue(cfg.comandos.dlq, cfg.dlx, cfg.comandos.acks.dlqRoutingKey);
      // Con `mandatory`, un comando sin cola regresa aquí antes de su confirmación.
      pubCh.on('return', (msg) => {
        if (msg.properties.messageId) this.comandosDevueltos.add(String(msg.properties.messageId));
      });
      await this.registerConsumer(acksCh, cfg.comandos.acks, QUEUE_LABEL.comandosAcks, (m) =>
        this.comandosAcksConsumer.consume(m),
      );
      this.comandosChannel = pubCh;
      this.logger.log('Canal de comandos activo');
    } catch (error) {
      this.comandosChannel = null;
      this.logger.error(
        `Canal de comandos apagado (la ingesta sigue): ${(error as Error)?.message}. Revisar permisos del usuario en el broker.`,
      );
    }
  }

  /**
   * Publica un comando en `telemetry.commands` con routing key `<protocolo>.cmd` y espera
   * la confirmación del broker. Sin conexión o con RabbitMQ apagado → error:
   * el comando se queda pendiente y ComandosService lo reintenta.
   */
  async publicarComando(
    protocolo: string,
    messageId: string,
    cuerpo: Record<string, unknown>,
    /** Lo que le queda de vigencia: el broker lo descarta si nadie lo consume antes. */
    vigenciaMs?: number,
  ): Promise<void> {
    const ch = this.comandosChannel;
    if (!ch || !this.cfg?.enabled) throw new Error('RabbitMQ no disponible para publicar comandos');
    ch.publish(this.cfg.comandos.exchange, `${protocolo}.cmd`, Buffer.from(JSON.stringify(cuerpo)), {
      contentType: 'application/json',
      deliveryMode: 2,
      messageId,
      headers: { protocol: protocolo, kind: 'command' },
      mandatory: true,
      ...(vigenciaMs != null ? { expiration: String(Math.max(1000, Math.round(vigenciaMs))) } : {}),
    });
    await ch.waitForConfirms();
    if (this.comandosDevueltos.delete(messageId)) {
      throw new Error(`sin cola para ${protocolo}.cmd (¿socket sin desplegar o binding faltante?)`);
    }
  }

  /** ¿Se pueden publicar comandos ahora? (el relay no intenta si no). */
  comandosDisponible(): boolean {
    return this.comandosChannel != null && !!this.cfg?.enabled;
  }

  private async runWatchdog(thresholdMinutes: number) {
    if (this.stopping || !this.cfg?.enabled) {
      return;
    }
    const snapshot = this.metrics.getConsumerState();
    if (!snapshot.connected) {
      return;
    }
    // Silencio por MySQL caído, no por el broker: reconectar soltaría los mensajes en espera.
    if (!this.dbGate.isOpen) {
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
      this.closedChannels.add(ch);
    }
    for (const ch of channels) {
      await ch.close().catch(() => undefined);
    }
    if (this.comandosChannel) {
      await this.comandosChannel.close().catch(() => undefined);
      this.comandosChannel = null;
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
    channel.on('close', () => this.closedChannels.add(channel));
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

    this.bindChannelEvents(axproEventsCh, 'axpro-events');
    this.bindChannelEvents(axproHbCh, 'axpro-heartbeats');
    this.bindChannelEvents(avlEventsCh, 'avl-events');
    this.bindChannelEvents(avlAlarmsCh, 'avl-alarms');

    for (const ch of [
      axproEventsCh,
      axproHbCh,
      avlEventsCh,
      avlAlarmsCh,
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

    await this.setupQueue(avlEventsCh, cfg.exchange, cfg.dlx, cfg.avl.events);
    await this.setupQueue(avlAlarmsCh, cfg.exchange, cfg.dlx, cfg.avl.alarms);
    await avlEventsCh.assertQueue(cfg.avl.dlq, { durable: true });
    await avlEventsCh.bindQueue(
      cfg.avl.dlq,
      cfg.dlx,
      cfg.avl.events.dlqRoutingKey,
    );


    this.retryListo = await this.prepararReintentos(cfg);

    await this.registerConsumer(
      axproEventsCh,
      cfg.axpro.events,
      QUEUE_LABEL.axproEvents,
      (m) => this.axproEventsConsumer.consume(m),
    );
    await this.registerConsumer(
      axproHbCh,
      cfg.axpro.heartbeats,
      QUEUE_LABEL.axproHeartbeats,
      (m) => this.axproHeartbeatsConsumer.consume(m),
    );
    await this.registerConsumer(
      avlEventsCh,
      cfg.avl.events,
      QUEUE_LABEL.avlEvents,
      (m) => this.avlEventsConsumer.consume(m, 'position'),
      llaveEquipo,
    );
    await this.registerConsumer(
      avlAlarmsCh,
      cfg.avl.alarms,
      QUEUE_LABEL.avlAlarms,
      (m) => this.avlEventsConsumer.consume(m, 'alarm'),
      llaveEquipo,
    );
    // Comandos aparte: si el broker los rechaza (permisos), la ingesta sigue.
    await this.prepararComandos(cfg);

    this.logger.log(
      `Consumidores activos (prefetch axpro=${cfg.axpro.events.prefetch}/${cfg.axpro.heartbeats.prefetch}, avl=${cfg.avl.events.prefetch}/${cfg.avl.alarms.prefetch}, maxDb=${cfg.maxConcurrentDb}, maxRetries=${cfg.maxRetries}, esperaBD<=${cfg.dbRetryMaxDelayMs}ms)`,
    );
  }

  private async registerConsumer(
    channel: Channel,
    queueDef: RabbitMqQueueDefinition,
    label: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
    /** Llave de orden: los mensajes de una misma llave (equipo) se procesan uno a uno, en orden. */
    llave?: (msg: ConsumeMessage) => string | null,
  ) {
    const { consumerTag } = await channel.consume(
      queueDef.queue,
      (msg) => {
        if (!msg) {
          return;
        }
        // Todo el ciclo del mensaje (espera de BD, ingesta, ack o DLQ) en el turno de su equipo.
        this.ordenPorEquipo
          .run(llave?.(msg), () => this.onMessage(msg, channel, label, queueDef, () => handler(msg)))
          .catch(
          (error: unknown) => {
            // ack/nack sobre un canal ya cerrado: el broker reentrega el mensaje.
            this.logger.warn(
              `${label} no se pudo confirmar el mensaje: ${(error as Error)?.message}`,
            );
          },
        );
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
      dbGate: this.dbGate,
      dbHoldMaxMs: this.cfg!.dbHoldMaxMs,
      isChannelClosed: () => this.closedChannels.has(channel),
      ...(this.retryListo ? { retry: this.cfg!.retry } : {}),
    }, handler);
  }
}

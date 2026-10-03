import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';
import { RabbitMqQueuesStatusService } from './rabbitmq-queues-status.service';

@ApiTags('Health')
@Controller('health')
export class RabbitMqHealthController {
  constructor(
    private readonly metrics: RabbitMqMetricsService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly queuesStatus: RabbitMqQueuesStatusService,
  ) {}

  @Get('rabbitmq')
  @ApiOperation({
    summary: 'Estado del consumidor RabbitMQ y pool de conexiones MySQL',
  })
  getRabbitMqHealth() {
    const enabled =
      String(this.config.get('RABBITMQ_ENABLED') ?? 'false').toLowerCase() ===
      'true';
    const snapshot = this.metrics.getSnapshot(this.dataSource);

    if (enabled && !snapshot.connected) {
      throw new ServiceUnavailableException({
        rabbitmq: snapshot,
        message: 'Consumidor RabbitMQ no conectado',
      });
    }

    const watchdogMinutes =
      Number(this.config.get('CONSUMER_WATCHDOG_MINUTES') ?? 15) || 15;
    if (enabled && snapshot.lastMessageAt) {
      const silentMs =
        Date.now() - new Date(snapshot.lastMessageAt).getTime();
      const thresholdMs = watchdogMinutes * 60 * 1000;
      if (silentMs > thresholdMs) {
        return {
          status: 'degraded',
          warning: `Sin mensajes consumidos en ${Math.round(silentMs / 60000)} min`,
          rabbitmq: snapshot,
        };
      }
    }

    return {
      status: enabled ? (snapshot.connected ? 'ok' : 'down') : 'disabled',
      rabbitmq: snapshot,
    };
  }

  @Get('rabbitmq/queues')
  @ApiOperation({
    summary: 'Estado por cola RabbitMQ (broker + contadores del consumidor)',
    description: [
      'Solo observabilidad: consulta el broker con checkQueue en un canal temporal (timeout 5 s) y no toca los consumidores.',
      '',
      '**Contadores en memoria**: `processed`, `failed`, `dlq`, `duplicate`, `lastMessageAt` y `byProtocol` se reinician al reiniciar el servicio (ver `uptimeSeconds`).',
      '',
      '**state por cola de trabajo**: `down` sin consumidores o cola inexistente; `degraded` con más de 100 mensajes acumulados o fallos/DLQ dentro de `QUEUE_IDLE_WARN_SECONDS`; `idle` sin mensajes en `QUEUE_IDLE_WARN_SECONDS` (solo avl.events y axpro.heartbeats); `ok` en otro caso.',
      '**state por DLQ**: `degraded` si tiene mensajes; `ok` si está vacía.',
      '**status global**: `disabled` (RABBITMQ_ENABLED=false), `down` (sin conexión o alguna cola de trabajo down), `degraded` (alguna degraded/idle), `ok`.',
      '',
      'Responde 200 aunque el status sea down/degraded; 503 solo si falla la consulta misma.',
    ].join('\n'),
  })
  async getRabbitMqQueues() {
    try {
      return await this.queuesStatus.getStatus();
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        message: `No se pudo obtener el estado de las colas: ${(error as Error)?.message ?? 'error'}`,
      });
    }
  }
}

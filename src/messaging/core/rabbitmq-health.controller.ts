import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

@ApiTags('Health')
@Controller('health')
export class RabbitMqHealthController {
  constructor(
    private readonly metrics: RabbitMqMetricsService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
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
}

import { Module } from '@nestjs/common';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

/** Instancia única de métricas, compartida por RabbitMqModule y AvlModule (evita import circular). */
@Module({
  providers: [RabbitMqMetricsService],
  exports: [RabbitMqMetricsService],
})
export class RabbitMqMetricsModule {}

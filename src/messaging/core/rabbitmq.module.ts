import { Module } from '@nestjs/common';
import { AvlModule } from '../avl/avl.module';
import { AxproModule } from '../axpro/axpro.module';
import { RabbitMqHealthController } from './rabbitmq-health.controller';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

@Module({
  imports: [AxproModule, AvlModule],
  controllers: [RabbitMqHealthController],
  providers: [RabbitMqConnectionService, RabbitMqMetricsService],
  exports: [RabbitMqConnectionService, RabbitMqMetricsService],
})
export class RabbitMqModule {}

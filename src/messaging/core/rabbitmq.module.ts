import { Module } from '@nestjs/common';
import { AvlModule } from '../avl/avl.module';
import { AxproModule } from '../axpro/axpro.module';
import { RabbitMqHealthController } from './rabbitmq-health.controller';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqMetricsModule } from './rabbitmq-metrics.module';
import { RabbitMqQueuesStatusService } from './rabbitmq-queues-status.service';

@Module({
  imports: [AxproModule, AvlModule, RabbitMqMetricsModule],
  controllers: [RabbitMqHealthController],
  providers: [RabbitMqConnectionService, RabbitMqQueuesStatusService],
  exports: [RabbitMqConnectionService, RabbitMqMetricsModule],
})
export class RabbitMqModule {}

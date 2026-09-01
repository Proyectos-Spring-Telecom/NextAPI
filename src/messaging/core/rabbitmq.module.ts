import { Module } from '@nestjs/common';
import { AxproModule } from '../axpro/axpro.module';
import { Jt808Module } from '../jt808/jt808.module';
import { RabbitMqHealthController } from './rabbitmq-health.controller';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqMetricsService } from './rabbitmq-metrics.service';

@Module({
  imports: [AxproModule, Jt808Module],
  controllers: [RabbitMqHealthController],
  providers: [RabbitMqConnectionService, RabbitMqMetricsService],
  exports: [RabbitMqConnectionService, RabbitMqMetricsService],
})
export class RabbitMqModule {}

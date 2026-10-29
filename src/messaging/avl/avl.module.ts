import { Module } from '@nestjs/common';
import { RabbitMqMetricsModule } from '../core/rabbitmq-metrics.module';
import { Fa100sModule } from '../fa100s/fa100s.module';
import { JimiModule } from '../jimi/jimi.module';
import { Jt808Module } from '../jt808/jt808.module';
import { AvlEventsConsumer } from './avl-events.consumer';

@Module({
  imports: [Jt808Module, JimiModule, Fa100sModule, RabbitMqMetricsModule],
  providers: [AvlEventsConsumer],
  exports: [AvlEventsConsumer],
})
export class AvlModule {}

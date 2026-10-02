import { Module } from '@nestjs/common';
import { JimiModule } from '../jimi/jimi.module';
import { Jt808Module } from '../jt808/jt808.module';
import { AvlEventsConsumer } from './avl-events.consumer';

@Module({
  imports: [Jt808Module, JimiModule],
  providers: [AvlEventsConsumer],
  exports: [AvlEventsConsumer],
})
export class AvlModule {}

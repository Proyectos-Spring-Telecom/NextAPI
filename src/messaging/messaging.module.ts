import { Module } from '@nestjs/common';
import { AxproModule } from './axpro/axpro.module';
import { RabbitMqModule } from './core/rabbitmq.module';
import { JimiModule } from './jimi/jimi.module';
import { Jt808Module } from './jt808/jt808.module';

@Module({
  imports: [RabbitMqModule, AxproModule, Jt808Module, JimiModule],
  exports: [AxproModule, Jt808Module, JimiModule],
})
export class MessagingModule {}

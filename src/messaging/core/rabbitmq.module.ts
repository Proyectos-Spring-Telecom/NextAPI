import { Module } from '@nestjs/common';
import { AxproModule } from '../axpro/axpro.module';
import { Jt808Module } from '../jt808/jt808.module';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';

@Module({
  imports: [AxproModule, Jt808Module],
  providers: [RabbitMqConnectionService],
  exports: [RabbitMqConnectionService],
})
export class RabbitMqModule {}

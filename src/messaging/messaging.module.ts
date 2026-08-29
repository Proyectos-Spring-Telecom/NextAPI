import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmasModule } from 'src/alarmas/alarmas.module';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { AxproIngestService } from './axpro-ingest.service';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';

@Module({
  imports: [AlarmasModule, TypeOrmModule.forFeature([PanelAlarma])],
  providers: [AxproIngestService, RabbitMqConnectionService],
  exports: [AxproIngestService],
})
export class MessagingModule {}

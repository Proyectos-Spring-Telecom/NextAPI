import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmasModule } from 'src/alarmas/alarmas.module';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { AxproEventsConsumer } from './axpro-events.consumer';
import { AxproHeartbeatsConsumer } from './axpro-heartbeats.consumer';
import { AxproIngestService } from './axpro-ingest.service';

@Module({
  imports: [AlarmasModule, TypeOrmModule.forFeature([PanelAlarma])],
  providers: [
    AxproIngestService,
    AxproEventsConsumer,
    AxproHeartbeatsConsumer,
  ],
  exports: [
    AxproIngestService,
    AxproEventsConsumer,
    AxproHeartbeatsConsumer,
  ],
})
export class AxproModule {}

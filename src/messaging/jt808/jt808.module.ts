import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { MessagingSharedModule } from '../shared/shared.module';
import { Jt808EventsConsumer } from './jt808-events.consumer';
import { Jt808IngestService } from './jt808-ingest.service';
import { Jt808PhotoConsumer } from './jt808-photo.consumer';

@Module({
  imports: [
    MessagingSharedModule,
    TypeOrmModule.forFeature([Posiciones, TelemetryIngestLog]),
  ],
  providers: [Jt808IngestService, Jt808EventsConsumer, Jt808PhotoConsumer],
  exports: [Jt808IngestService, Jt808EventsConsumer, Jt808PhotoConsumer],
})
export class Jt808Module {}

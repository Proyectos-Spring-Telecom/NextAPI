import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Fotos } from 'src/entities/Fotos';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { Videos } from 'src/entities/Videos';
import { DeviceLookupService } from './device-lookup.service';
import { PosicionIngestService } from './posicion-ingest.service';

@Module({
  imports: [
    MonitoreoModule,
    TypeOrmModule.forFeature([
      Dispositivos,
      Posiciones,
      TelemetryIngestLog,
      Fotos,
      Videos,
    ]),
  ],
  providers: [DeviceLookupService, PosicionIngestService],
  exports: [DeviceLookupService, PosicionIngestService],
})
export class MessagingSharedModule {}

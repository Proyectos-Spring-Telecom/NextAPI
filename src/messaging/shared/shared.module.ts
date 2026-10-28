import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { IncidentesAutoModule } from 'src/incidentes/auto/incidentes-auto.module';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Fotos } from 'src/entities/Fotos';
import { Geocercas } from 'src/entities/Geocercas';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { Videos } from 'src/entities/Videos';
import { DeviceLookupService } from './device-lookup.service';
import { PosicionIngestService } from './posicion-ingest.service';
import { TelemetriaHuerfanosModule } from 'src/telemetria-huerfanos/telemetria-huerfanos.module';

@Module({
  imports: [
    MonitoreoModule,
    TelemetriaHuerfanosModule,
    IncidentesAutoModule,
    TypeOrmModule.forFeature([
      Dispositivos,
      Posiciones,
      TelemetryIngestLog,
      Fotos,
      Videos,
      Geocercas,
    ]),
  ],
  providers: [DeviceLookupService, PosicionIngestService],
  exports: [DeviceLookupService, PosicionIngestService, TelemetriaHuerfanosModule],
})
export class MessagingSharedModule {}

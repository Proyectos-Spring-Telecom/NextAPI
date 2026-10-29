import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Incidentes } from 'src/entities/Incidentes';
import { Posiciones } from 'src/entities/Posiciones';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import { IncidentesAutoService } from './incidentes-auto.service';

/** Módulo ligero (solo repos) para que el ingest de telemetría lo importe sin ciclos. */
@Module({
  imports: [TypeOrmModule.forFeature([
      Incidentes,
      Posiciones,
      Dispositivos,
      SeguimientoIncidentes,
    ]),
  ],
  providers: [IncidentesAutoService],
  exports: [IncidentesAutoService],
})
export class IncidentesAutoModule {}

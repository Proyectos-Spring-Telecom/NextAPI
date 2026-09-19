import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { Incidentes } from 'src/entities/Incidentes';
import { Posiciones } from 'src/entities/Posiciones';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incidentes,
      SeguimientoIncidentes,
      Posiciones,
      EventoAlarma,
      Dispositivos,
      Clientes,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [IncidentesController],
  providers: [IncidentesService],
  exports: [IncidentesService],
})
export class IncidentesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { HistoricoInstalacionesController } from './historico-instalaciones.controller';
import { HistoricoInstalacionesService } from './historico-instalaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HistoricoInstalaciones,
      Instalaciones,
      Dispositivos,
      Vehiculos,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [HistoricoInstalacionesController],
  providers: [HistoricoInstalacionesService],
  exports: [HistoricoInstalacionesService],
})
export class HistoricoInstalacionesModule {}

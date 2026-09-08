import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geocercas } from 'src/entities/Geocercas';
import { UsuariosGeocerca } from 'src/entities/UsuariosGeocerca';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Usuarios } from 'src/entities/Usuarios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { GeocercasController } from './geocercas.controller';
import { GeocercasService } from './geocercas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Geocercas,
      UsuariosGeocerca,
      Clientes,
      Instalaciones,
      Usuarios,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [GeocercasController],
  providers: [GeocercasService],
  exports: [GeocercasService],
})
export class GeocercasModule {}

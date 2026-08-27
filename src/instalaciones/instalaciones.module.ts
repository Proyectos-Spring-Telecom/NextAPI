import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { Productos } from 'src/entities/Productos';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { InstalacionesController } from './instalaciones.controller';
import { InstalacionesService } from './instalaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      HistoricoInstalaciones,
      Dispositivos,
      Sims,
      Productos,
      CatEstatusInstalacion,
      Usuarios,
      UsuariosInstalaciones,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
  exports: [InstalacionesService],
})
export class InstalacionesModule {}

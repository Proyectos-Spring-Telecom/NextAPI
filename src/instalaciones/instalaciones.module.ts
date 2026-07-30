import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { InstalacionesController } from './instalaciones.controller';
import { InstalacionesService } from './instalaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      Dispositivos,
      Sims,
      CatEstatusInstalacion,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
  exports: [InstalacionesService],
})
export class InstalacionesModule {}

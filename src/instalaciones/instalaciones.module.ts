import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { InstalacionesController } from './instalaciones.controller';
import { InstalacionesService } from './instalaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      Dispositivos,
      Vehiculos,
      CatEstatusInstalacion,
    ]),
    BitacoraModule,
  ],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
  exports: [InstalacionesService],
})
export class InstalacionesModule {}

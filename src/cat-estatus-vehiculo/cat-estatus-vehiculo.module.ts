import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusVehiculo } from 'src/entities/CatEstatusVehiculo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusVehiculoController } from './cat-estatus-vehiculo.controller';
import { CatEstatusVehiculoService } from './cat-estatus-vehiculo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusVehiculo]),
    BitacoraModule,
  ],
  controllers: [CatEstatusVehiculoController],
  providers: [CatEstatusVehiculoService],
  exports: [CatEstatusVehiculoService],
})
export class CatEstatusVehiculoModule {}

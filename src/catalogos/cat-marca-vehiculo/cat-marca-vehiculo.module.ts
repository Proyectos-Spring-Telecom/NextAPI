import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatMarcaVehiculo } from 'src/entities/CatMarcaVehiculo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMarcaVehiculoController } from './cat-marca-vehiculo.controller';
import { CatMarcaVehiculoService } from './cat-marca-vehiculo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatMarcaVehiculo]),
    BitacoraModule,
  ],
  controllers: [CatMarcaVehiculoController],
  providers: [CatMarcaVehiculoService],
  exports: [CatMarcaVehiculoService],
})
export class CatMarcaVehiculoModule {}

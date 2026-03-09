import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatModeloVehiculo } from 'src/entities/CatModeloVehiculo';
import { CatMarcaVehiculo } from 'src/entities/CatMarcaVehiculo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatModeloVehiculoController } from './cat-modelo-vehiculo.controller';
import { CatModeloVehiculoService } from './cat-modelo-vehiculo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatModeloVehiculo, CatMarcaVehiculo]),
    BitacoraModule,
  ],
  controllers: [CatModeloVehiculoController],
  providers: [CatModeloVehiculoService],
  exports: [CatModeloVehiculoService],
})
export class CatModeloVehiculoModule {}

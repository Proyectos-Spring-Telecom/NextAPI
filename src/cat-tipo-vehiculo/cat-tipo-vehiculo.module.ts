import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoVehiculo } from 'src/entities/CatTipoVehiculo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoVehiculoController } from './cat-tipo-vehiculo.controller';
import { CatTipoVehiculoService } from './cat-tipo-vehiculo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoVehiculo]),
    BitacoraModule,
  ],
  controllers: [CatTipoVehiculoController],
  providers: [CatTipoVehiculoService],
  exports: [CatTipoVehiculoService],
})
export class CatTipoVehiculoModule {}

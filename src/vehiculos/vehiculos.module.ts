import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModeloVehiculo } from 'src/entities/CatModeloVehiculo';
import { CatMarcaVehiculo } from 'src/entities/CatMarcaVehiculo';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehiculos,
      CatMarcaVehiculo,
      CatModeloVehiculo,
      CatTipoCombustible,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService],
  exports: [VehiculosService],
})
export class VehiculosModule {}

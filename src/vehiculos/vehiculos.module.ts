import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModelos } from 'src/entities/CatModelos';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { Productos } from 'src/entities/Productos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { WebhookEmitterModule } from 'src/webhook-emitter/webhook-emitter.module';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehiculos,
      CatMarcas,
      CatModelos,
      CatTipoCombustible,
      Productos,
    ]),
    BitacoraModule,
    TenantFilterModule,
    WebhookEmitterModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService],
  exports: [VehiculosService],
})
export class VehiculosModule {}

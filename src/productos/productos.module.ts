import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Productos } from 'src/entities/Productos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { InmueblesModule } from './inmuebles/inmuebles.module';
import { ActivosModule } from './activos/activos.module';
import { PersonasModule } from './personas/personas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Productos]),
    BitacoraModule,
    TenantFilterModule,
    VehiculosModule,
    InmueblesModule,
    ActivosModule,
    PersonasModule,
  ],
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule {}

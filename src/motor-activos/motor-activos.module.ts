import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusRecurso } from 'src/entities/CatEstatusRecurso';
import { MovimientosRecurso } from 'src/entities/MovimientosRecurso';
import { MotorActivosController } from './motor-activos.controller';
import { MotorActivosService } from './motor-activos.service';

/** Global: lo usan instalaciones, órdenes y los CRUD de dispositivos, SIM y productos. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CatEstatusRecurso, MovimientosRecurso])],
  controllers: [MotorActivosController],
  providers: [MotorActivosService],
  exports: [MotorActivosService],
})
export class MotorActivosModule {}

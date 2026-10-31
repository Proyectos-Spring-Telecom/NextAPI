import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusRecurso } from 'src/entities/CatEstatusRecurso';
import { MovimientosRecurso } from 'src/entities/MovimientosRecurso';
import { MotorActivosController } from './motor-activos.controller';
import { MotorActivosService } from './motor-activos.service';
import { TramosInstalacionService } from './tramos-instalacion.service';

/**
 * Global: el motor lo usan instalaciones, órdenes y los CRUD de dispositivos, SIM y
 * productos; los tramos, todo lo que lee posiciones (monitoreo, reportes, consola…).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CatEstatusRecurso, MovimientosRecurso])],
  controllers: [MotorActivosController],
  providers: [MotorActivosService, TramosInstalacionService],
  exports: [MotorActivosService, TramosInstalacionService],
})
export class MotorActivosModule {}

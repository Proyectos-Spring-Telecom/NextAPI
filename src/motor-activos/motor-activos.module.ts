import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusRecurso } from 'src/entities/CatEstatusRecurso';
import { MovimientosRecurso } from 'src/entities/MovimientosRecurso';
import { MotorActivosController } from './motor-activos.controller';
import { MotorActivosService } from './motor-activos.service';
import { TramosInstalacionService } from './tramos-instalacion.service';
import { RegistroTrackcamService } from './registro-trackcam.service';
import { WebhookEmitterModule } from 'src/webhook-emitter/webhook-emitter.module';

/**
 * Global: el motor lo usan instalaciones, órdenes y los CRUD de dispositivos, SIM y
 * productos; los tramos, todo lo que lee posiciones (monitoreo, reportes, consola…).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CatEstatusRecurso, MovimientosRecurso]), WebhookEmitterModule],
  controllers: [MotorActivosController],
  providers: [MotorActivosService, TramosInstalacionService, RegistroTrackcamService],
  exports: [MotorActivosService, TramosInstalacionService, RegistroTrackcamService],
})
export class MotorActivosModule {}

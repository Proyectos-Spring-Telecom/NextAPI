import { Module } from '@nestjs/common';
import { RabbitMqModule } from 'src/messaging/core/rabbitmq.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { ComandosService } from './comandos.service';
import { RelojComandosService } from './reloj-comandos.service';
import { RelojComandosController } from './reloj-comandos.controller';
import { TrackCamComandosService } from './trackcam-comandos.service';
import { TrackCamComandosController } from './trackcam-comandos.controller';

/** Comandos de Next a los equipos (docs/motor-activos.md §8). */
@Module({
  imports: [RabbitMqModule, TenantFilterModule],
  controllers: [RelojComandosController, TrackCamComandosController],
  providers: [ComandosService, RelojComandosService, TrackCamComandosService],
  exports: [ComandosService],
})
export class ComandosModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { WebhookEmitterModule } from 'src/webhook-emitter/webhook-emitter.module';
import { TrackcamController } from './trackcam.controller';
import { TrackcamService } from './trackcam.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackcamConfig, Dispositivos]),
    BitacoraModule,
    TenantFilterModule,
    WebhookEmitterModule,
  ],
  controllers: [TrackcamController],
  providers: [TrackcamService],
  exports: [TrackcamService],
})
export class TrackcamModule {}

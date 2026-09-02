import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { GatewayIngestLog } from 'src/entities/GatewayIngestLog';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { UltimoEventoAlarma } from 'src/entities/UltimoEventoAlarma';
import { AlarmasController } from './alarmas.controller';
import { AlarmasGateway } from './alarmas.gateway';
import { AlarmasIngestController } from './alarmas-ingest.controller';
import { AlarmasIngestService } from './alarmas-ingest.service';
import { AlarmasService } from './alarmas.service';
import { GatewayHmacGuard } from './gateway/gateway-hmac.guard';
import { PanelOnlineScheduler } from './panel-online.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventoAlarma,
      UltimoEventoAlarma,
      PanelAlarma,
      GatewayIngestLog,
    ]),
    AuthModule,
    MonitoreoModule,
    TenantFilterModule,
  ],
  controllers: [AlarmasIngestController, AlarmasController],
  providers: [
    AlarmasService,
    AlarmasIngestService,
    AlarmasGateway,
    GatewayHmacGuard,
    PanelOnlineScheduler,
  ],
  exports: [AlarmasIngestService],
})
export class AlarmasModule {}

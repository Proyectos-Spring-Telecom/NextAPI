import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { MonitoreoController } from './monitoreo.controller';
import { MonitoreoGateway } from './monitoreo.gateway';
import { MonitoreoService } from './monitoreo.service';
import { TrackcamGatewayClient } from './trackcam-gateway.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instalaciones, Posiciones]),
    TenantFilterModule,
    AuthModule,
    HttpModule.register({
      maxRedirects: 3,
    }),
  ],
  controllers: [MonitoreoController],
  providers: [MonitoreoService, MonitoreoGateway, TrackcamGatewayClient],
  exports: [MonitoreoService, MonitoreoGateway],
})
export class MonitoreoModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { Instalaciones } from 'src/entities/Instalaciones';
import { MonitoreoController } from './monitoreo.controller';
import { MonitoreoGateway } from './monitoreo.gateway';
import { MonitoreoService } from './monitoreo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instalaciones]),
    TenantFilterModule,
    AuthModule,
  ],
  controllers: [MonitoreoController],
  providers: [MonitoreoService, MonitoreoGateway],
  exports: [MonitoreoService, MonitoreoGateway],
})
export class MonitoreoModule {}

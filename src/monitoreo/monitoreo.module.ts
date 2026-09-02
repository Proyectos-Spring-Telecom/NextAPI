import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { Instalaciones } from 'src/entities/Instalaciones';
import { MonitoreoController } from './monitoreo.controller';
import { MonitoreoService } from './monitoreo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Instalaciones]), TenantFilterModule],
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
})
export class MonitoreoModule {}

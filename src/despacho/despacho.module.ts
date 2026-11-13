import { Module } from '@nestjs/common';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { LlavesApiModule } from 'src/llaves-api/llaves-api.module';
import { ReportesModule } from 'src/reportes/reportes.module';
import { DespachoController } from './despacho.controller';
import { DespachoService } from './despacho.service';

/** Despacho de rutas y trabajos (docs/fis-fiber, ruta del back §3.9). */
@Module({
  imports: [TenantFilterModule, ReportesModule, LlavesApiModule],
  controllers: [DespachoController],
  providers: [DespachoService],
})
export class DespachoModule {}

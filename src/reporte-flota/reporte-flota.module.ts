import { Module } from '@nestjs/common';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { GeocodificacionService } from './geocodificacion.service';
import { ReporteFlotaController } from './reporte-flota.controller';
import { ReporteFlotaService } from './reporte-flota.service';

/** Reporte de flota (vista legacy "Reporte de Vehículos"): docs/front-next.md §34. */
@Module({
  imports: [MonitoreoModule, TenantFilterModule],
  controllers: [ReporteFlotaController],
  providers: [ReporteFlotaService, GeocodificacionService],
})
export class ReporteFlotaModule {}

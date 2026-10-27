import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Geocercas } from 'src/entities/Geocercas';
import { Clientes } from 'src/entities/Clientes';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ProductosClienteController } from './productos-cliente.controller';
import { ProductosClienteService } from './productos-cliente.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PuntosInteres,
      Instalaciones,
      Geocercas,
      Clientes,
      HistoricoInstalaciones,
    ]),
    TenantFilterModule,
  ],
  controllers: [ReportesController, ProductosClienteController],
  providers: [ReportesService, ProductosClienteService],
  exports: [ReportesService],
})
export class ReportesModule {}

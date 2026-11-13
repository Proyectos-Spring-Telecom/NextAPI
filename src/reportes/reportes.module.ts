import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Geocercas } from 'src/entities/Geocercas';
import { Clientes } from 'src/entities/Clientes';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { JornadaService } from './jornada.service';
import { JornadaController } from './jornada.controller';
import { ContadoresController } from './contadores.controller';
import { ContadoresService } from './contadores.service';
import { ResumenDiarioService } from './resumen-diario.service';
import { GeocercasEventosService } from './geocercas-eventos.service';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ProductosClienteController } from './productos-cliente.controller';
import { ProductosClienteService } from './productos-cliente.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PuntosInteres, Instalaciones, Geocercas, Clientes]),
    TenantFilterModule,
    BitacoraModule,
  ],
  controllers: [
    ReportesController,
    JornadaController,
    ContadoresController,
    ProductosClienteController,
  ],
  providers: [
    ReportesService,
    JornadaService,
    ResumenDiarioService,
    ContadoresService,
    GeocercasEventosService,
    ProductosClienteService,
  ],
  exports: [ReportesService],
})
export class ReportesModule {}

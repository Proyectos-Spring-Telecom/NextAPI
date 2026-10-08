import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Geocercas } from 'src/entities/Geocercas';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Licencias } from 'src/entities/Licencias';
import { Operadores } from 'src/entities/Operadores';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Posiciones } from 'src/entities/Posiciones';
import { Productos } from 'src/entities/Productos';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Sims } from 'src/entities/Sims';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { Usuarios } from 'src/entities/Usuarios';
import { Vehiculos } from 'src/entities/Vehiculos';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      Productos,
      CatTipoProducto,
      Vehiculos,
      Dispositivos,
      CatTipoDispositivo,
      UltimaPosicion,
      PanelAlarma,
      Posiciones,
      Clientes,
      Usuarios,
      Sims,
      Geocercas,
      PuntosInteres,
      Operadores,
      Licencias,
    ]),
    TenantFilterModule,
    MonitoreoModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

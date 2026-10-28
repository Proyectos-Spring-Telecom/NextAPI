import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { RelojConfig } from 'src/entities/RelojConfig';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { PanelesModule } from './paneles/paneles.module';
import { RelojesModule } from './relojes/relojes.module';
import { TrackcamModule } from './trackcam/trackcam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispositivos,
      PanelAlarma,
      Instalaciones,
      HistoricoInstalaciones,
      TrackcamConfig,
      RelojConfig,
      Clientes,
    ]),
    BitacoraModule,
    TenantFilterModule,
    PanelesModule,
    TrackcamModule,
    RelojesModule,
  ],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}

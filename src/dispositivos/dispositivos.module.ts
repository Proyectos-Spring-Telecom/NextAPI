import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { PanelesModule } from './paneles/paneles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispositivos, PanelAlarma]),
    BitacoraModule,
    TenantFilterModule,
    PanelesModule,
  ],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}

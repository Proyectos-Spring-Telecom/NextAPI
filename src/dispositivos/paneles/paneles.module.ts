import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { PanelesController } from './paneles.controller';
import { PanelesService } from './paneles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PanelAlarma, Dispositivos]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [PanelesController],
  providers: [PanelesService],
  exports: [PanelesService],
})
export class PanelesModule {}

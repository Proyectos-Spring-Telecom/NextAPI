import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Inmuebles } from 'src/entities/Inmuebles';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { PanelAlarmaController } from './panel-alarma.controller';
import { PanelAlarmaService } from './panel-alarma.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PanelAlarma, Inmuebles]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [PanelAlarmaController],
  providers: [PanelAlarmaService],
  exports: [PanelAlarmaService],
})
export class PanelAlarmaModule {}

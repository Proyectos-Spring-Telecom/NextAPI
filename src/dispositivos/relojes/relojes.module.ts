import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelojConfig } from 'src/entities/RelojConfig';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { RelojesController } from './relojes.controller';
import { RelojesService } from './relojes.service';

/** Relojes FA100S: Dispositivos + RelojConfig. Sin webhook (solo TrackCam lo tiene). */
@Module({
  imports: [
    TypeOrmModule.forFeature([RelojConfig, Dispositivos]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [RelojesController],
  providers: [RelojesService],
  exports: [RelojesService],
})
export class RelojesModule {}

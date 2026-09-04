import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { PuntosInteresController } from './puntos-interes.controller';
import { PuntosInteresService } from './puntos-interes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PuntosInteres, Clientes]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [PuntosInteresController],
  providers: [PuntosInteresService],
  exports: [PuntosInteresService],
})
export class PuntosInteresModule {}

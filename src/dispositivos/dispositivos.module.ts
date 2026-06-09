import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatModeloDispositivo } from 'src/entities/CatModeloDispositivo';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { Sims } from 'src/entities/Sims';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispositivos,
      CatModeloDispositivo,
      CatTipoDispositivo,
      Sims,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatModelos } from 'src/entities/CatModelos';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispositivos,
      CatMarcas,
      CatModelos,
      CatTipoDispositivo,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}

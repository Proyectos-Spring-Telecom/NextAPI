import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { CatEstatusOperador } from 'src/entities/CatEstatusOperador';
import { Licencias } from 'src/entities/Licencias';
import { CatTipoLicencia } from 'src/entities/CatTipoLicencia';
import { CatCategoriaLicencia } from 'src/entities/CatCategoriaLicencia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { OperadoresController } from './operadores.controller';
import { OperadoresService } from './operadores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Operadores,
      Usuarios,
      CatEstatusOperador,
      Licencias,
      CatTipoLicencia,
      CatCategoriaLicencia,
    ]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [OperadoresController],
  providers: [OperadoresService],
  exports: [OperadoresService],
})
export class OperadoresModule {}

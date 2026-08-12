import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { Licencias } from 'src/entities/Licencias';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { OperadoresController } from './operadores.controller';
import { OperadoresService } from './operadores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operadores, Usuarios, Licencias]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [OperadoresController],
  providers: [OperadoresService],
  exports: [OperadoresService],
})
export class OperadoresModule {}

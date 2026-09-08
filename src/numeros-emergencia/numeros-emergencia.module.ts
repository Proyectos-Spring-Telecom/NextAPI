import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumerosEmergenciaCliente } from 'src/entities/NumerosEmergenciaCliente';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { NumerosEmergenciaController } from './numeros-emergencia.controller';
import { NumerosEmergenciaService } from './numeros-emergencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NumerosEmergenciaCliente, Clientes]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [NumerosEmergenciaController],
  providers: [NumerosEmergenciaService],
  exports: [NumerosEmergenciaService],
})
export class NumerosEmergenciaModule {}

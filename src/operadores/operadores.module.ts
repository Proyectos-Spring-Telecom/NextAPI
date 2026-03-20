import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { CatEstatusOperador } from 'src/entities/CatEstatusOperador';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { OperadoresController } from './operadores.controller';
import { OperadoresService } from './operadores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operadores, Usuarios, CatEstatusOperador]),
    BitacoraModule,
  ],
  controllers: [OperadoresController],
  providers: [OperadoresService],
  exports: [OperadoresService],
})
export class OperadoresModule {}

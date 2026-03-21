import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusOperador } from 'src/entities/CatEstatusOperador';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusOperadorController } from './cat-estatus-operador.controller';
import { CatEstatusOperadorService } from './cat-estatus-operador.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusOperador]),
    BitacoraModule,
  ],
  controllers: [CatEstatusOperadorController],
  providers: [CatEstatusOperadorService],
  exports: [CatEstatusOperadorService],
})
export class CatEstatusOperadorModule {}

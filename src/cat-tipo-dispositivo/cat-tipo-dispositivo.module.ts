import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoDispositivoController } from './cat-tipo-dispositivo.controller';
import { CatTipoDispositivoService } from './cat-tipo-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatTipoDispositivoController],
  providers: [CatTipoDispositivoService],
  exports: [CatTipoDispositivoService],
})
export class CatTipoDispositivoModule {}

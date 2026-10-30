import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { CatTipoDispositivoController } from './cat-tipo-dispositivo.controller';
import { CatTipoDispositivoService } from './cat-tipo-dispositivo.service';

@Module({
  imports: [TypeOrmModule.forFeature([CatTipoDispositivo])],
  controllers: [CatTipoDispositivoController],
  providers: [CatTipoDispositivoService],
  exports: [CatTipoDispositivoService],
})
export class CatTipoDispositivoModule {}

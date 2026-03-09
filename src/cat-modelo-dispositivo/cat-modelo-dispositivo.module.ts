import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatModeloDispositivo } from 'src/entities/CatModeloDispositivo';
import { CatMarcaDispositivo } from 'src/entities/CatMarcaDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatModeloDispositivoController } from './cat-modelo-dispositivo.controller';
import { CatModeloDispositivoService } from './cat-modelo-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatModeloDispositivo, CatMarcaDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatModeloDispositivoController],
  providers: [CatModeloDispositivoService],
  exports: [CatModeloDispositivoService],
})
export class CatModeloDispositivoModule {}

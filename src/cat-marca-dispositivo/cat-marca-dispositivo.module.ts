import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatMarcaDispositivo } from 'src/entities/CatMarcaDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMarcaDispositivoController } from './cat-marca-dispositivo.controller';
import { CatMarcaDispositivoService } from './cat-marca-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatMarcaDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatMarcaDispositivoController],
  providers: [CatMarcaDispositivoService],
  exports: [CatMarcaDispositivoService],
})
export class CatMarcaDispositivoModule {}

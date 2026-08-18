import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatModelosController } from './cat-modelos.controller';
import { CatModelosService } from './cat-modelos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatModelos, CatMarcas]),
    BitacoraModule,
  ],
  controllers: [CatModelosController],
  providers: [CatModelosService],
  exports: [CatModelosService],
})
export class CatModelosModule {}

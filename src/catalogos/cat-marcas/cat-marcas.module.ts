import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatProductos } from 'src/entities/CatProductos';
import { CatMarcasController } from './cat-marcas.controller';
import { CatMarcasService } from './cat-marcas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatMarcas, CatProductos, CatModelos]),
    BitacoraModule,
  ],
  controllers: [CatMarcasController],
  providers: [CatMarcasService],
  exports: [CatMarcasService],
})
export class CatMarcasModule {}

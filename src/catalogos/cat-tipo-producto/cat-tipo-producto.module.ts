import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { CatTipoProductoController } from './cat-tipo-producto.controller';
import { CatTipoProductoService } from './cat-tipo-producto.service';

@Module({
  imports: [TypeOrmModule.forFeature([CatTipoProducto])],
  controllers: [CatTipoProductoController],
  providers: [CatTipoProductoService],
  exports: [CatTipoProductoService],
})
export class CatTipoProductoModule {}

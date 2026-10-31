import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatProductos } from 'src/entities/CatProductos';
import { CatProductosController } from './cat-productos.controller';
import { CatProductosService } from './cat-productos.service';

@Module({
  imports: [TypeOrmModule.forFeature([CatProductos])],
  controllers: [CatProductosController],
  providers: [CatProductosService],
  exports: [CatProductosService],
})
export class CatProductosModule {}

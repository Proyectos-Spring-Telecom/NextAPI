import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatReferenciaServicio } from 'src/entities/CatReferenciaServicio';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatReferenciaServicioController } from './cat-referencia-servicio.controller';
import { CatReferenciaServicioService } from './cat-referencia-servicio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatReferenciaServicio]),
    BitacoraModule,
  ],
  controllers: [CatReferenciaServicioController],
  providers: [CatReferenciaServicioService],
  exports: [CatReferenciaServicioService],
})
export class CatReferenciaServicioModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoVerificaciones } from 'src/entities/CatTipoVerificaciones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoVerificacionesController } from './cat-tipo-verificaciones.controller';
import { CatTipoVerificacionesService } from './cat-tipo-verificaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoVerificaciones]),
    BitacoraModule,
  ],
  controllers: [CatTipoVerificacionesController],
  providers: [CatTipoVerificacionesService],
  exports: [CatTipoVerificacionesService],
})
export class CatTipoVerificacionesModule {}

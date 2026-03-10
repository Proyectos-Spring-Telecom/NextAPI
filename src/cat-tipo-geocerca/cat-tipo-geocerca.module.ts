import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoGeocerca } from 'src/entities/CatTipoGeocerca';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoGeocercaController } from './cat-tipo-geocerca.controller';
import { CatTipoGeocercaService } from './cat-tipo-geocerca.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoGeocerca]),
    BitacoraModule,
  ],
  controllers: [CatTipoGeocercaController],
  providers: [CatTipoGeocercaService],
  exports: [CatTipoGeocercaService],
})
export class CatTipoGeocercaModule {}

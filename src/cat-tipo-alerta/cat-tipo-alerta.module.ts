import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoAlerta } from 'src/entities/CatTipoAlerta';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoAlertaController } from './cat-tipo-alerta.controller';
import { CatTipoAlertaService } from './cat-tipo-alerta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoAlerta]),
    BitacoraModule,
  ],
  controllers: [CatTipoAlertaController],
  providers: [CatTipoAlertaService],
  exports: [CatTipoAlertaService],
})
export class CatTipoAlertaModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoLicencia } from 'src/entities/CatTipoLicencia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoLicenciaController } from './cat-tipo-licencia.controller';
import { CatTipoLicenciaService } from './cat-tipo-licencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoLicencia]),
    BitacoraModule,
  ],
  controllers: [CatTipoLicenciaController],
  providers: [CatTipoLicenciaService],
  exports: [CatTipoLicenciaService],
})
export class CatTipoLicenciaModule {}

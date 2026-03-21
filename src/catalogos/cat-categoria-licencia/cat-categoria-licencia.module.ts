import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatCategoriaLicencia } from 'src/entities/CatCategoriaLicencia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatCategoriaLicenciaController } from './cat-categoria-licencia.controller';
import { CatCategoriaLicenciaService } from './cat-categoria-licencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatCategoriaLicencia]),
    BitacoraModule,
  ],
  controllers: [CatCategoriaLicenciaController],
  providers: [CatCategoriaLicenciaService],
  exports: [CatCategoriaLicenciaService],
})
export class CatCategoriaLicenciaModule {}

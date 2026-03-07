import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusInstalacionController } from './cat-estatus-instalacion.controller';
import { CatEstatusInstalacionService } from './cat-estatus-instalacion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusInstalacion]),
    BitacoraModule,
  ],
  controllers: [CatEstatusInstalacionController],
  providers: [CatEstatusInstalacionService],
  exports: [CatEstatusInstalacionService],
})
export class CatEstatusInstalacionModule {}

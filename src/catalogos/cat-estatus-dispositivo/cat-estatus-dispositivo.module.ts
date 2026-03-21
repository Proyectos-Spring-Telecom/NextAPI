import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusDispositivo } from 'src/entities/CatEstatusDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusDispositivoController } from './cat-estatus-dispositivo.controller';
import { CatEstatusDispositivoService } from './cat-estatus-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatEstatusDispositivoController],
  providers: [CatEstatusDispositivoService],
  exports: [CatEstatusDispositivoService],
})
export class CatEstatusDispositivoModule {}

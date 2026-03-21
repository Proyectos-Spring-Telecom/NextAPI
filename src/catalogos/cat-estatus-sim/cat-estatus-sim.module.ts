import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusSim } from 'src/entities/CatEstatusSim';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusSimController } from './cat-estatus-sim.controller';
import { CatEstatusSimService } from './cat-estatus-sim.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusSim]),
    BitacoraModule,
  ],
  controllers: [CatEstatusSimController],
  providers: [CatEstatusSimService],
  exports: [CatEstatusSimService],
})
export class CatEstatusSimModule {}

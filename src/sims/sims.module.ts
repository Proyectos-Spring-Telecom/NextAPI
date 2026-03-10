import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { CatEstatusSim } from 'src/entities/CatEstatusSim';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { SimsController } from './sims.controller';
import { SimsService } from './sims.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sims,
      CatTelefonia,
      CatPlanesTelefonia,
      CatEstatusSim,
    ]),
    BitacoraModule,
  ],
  controllers: [SimsController],
  providers: [SimsService],
  exports: [SimsService],
})
export class SimsModule {}

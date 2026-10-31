import { Module } from '@nestjs/common';
import { VigilanciaTransmisionController } from './vigilancia-transmision.controller';
import { VigilanciaTransmisionService } from './vigilancia-transmision.service';
import { VigilanciaTransmisionScheduler } from './vigilancia-transmision.scheduler';

@Module({
  controllers: [VigilanciaTransmisionController],
  providers: [VigilanciaTransmisionService, VigilanciaTransmisionScheduler],
  exports: [VigilanciaTransmisionService],
})
export class VigilanciaTransmisionModule {}

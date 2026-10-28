import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryHuerfanos } from 'src/entities/TelemetryHuerfanos';
import { TelemetriaHuerfanosController } from './telemetria-huerfanos.controller';
import { TelemetriaHuerfanosService } from './telemetria-huerfanos.service';

@Module({
  imports: [TypeOrmModule.forFeature([TelemetryHuerfanos])],
  controllers: [TelemetriaHuerfanosController],
  providers: [TelemetriaHuerfanosService],
  exports: [TelemetriaHuerfanosService],
})
export class TelemetriaHuerfanosModule {}

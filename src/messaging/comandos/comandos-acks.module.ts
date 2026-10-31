import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComandosDispositivo } from 'src/entities/ComandosDispositivo';
import { Dispositivos } from 'src/entities/Dispositivos';
import { MonitoreoModule } from 'src/monitoreo/monitoreo.module';
import { ComandosAcksConsumer } from './comandos-acks.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([ComandosDispositivo, Dispositivos]), MonitoreoModule],
  providers: [ComandosAcksConsumer],
  exports: [ComandosAcksConsumer],
})
export class ComandosAcksModule {}

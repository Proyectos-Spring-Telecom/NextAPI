import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { DeviceLookupService } from './device-lookup.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dispositivos])],
  providers: [DeviceLookupService],
  exports: [DeviceLookupService],
})
export class MessagingSharedModule {}

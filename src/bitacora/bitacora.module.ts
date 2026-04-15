import { Module } from '@nestjs/common';
import { BitacoraLoggerService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bitacora } from 'src/entities/Bitacora';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bitacora]), TenantFilterModule],
  controllers: [BitacoraController],
  providers: [BitacoraLoggerService],
  exports: [BitacoraLoggerService],
})
export class BitacoraModule {}

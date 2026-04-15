import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { TenantFilterService } from './tenant-filter.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clientes])],
  providers: [TenantFilterService],
  exports: [TenantFilterService],
})
export class TenantFilterModule {}

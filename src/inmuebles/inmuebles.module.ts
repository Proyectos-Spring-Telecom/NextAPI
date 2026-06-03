import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inmuebles } from 'src/entities/Inmuebles';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { InmueblesController } from './inmuebles.controller';
import { InmueblesService } from './inmuebles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inmuebles]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}

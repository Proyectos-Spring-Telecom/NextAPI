import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Productos } from 'src/entities/Productos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { S3Module } from 'src/s3/s3.module';
import { InmueblesController } from './inmuebles.controller';
import { InmueblesService } from './inmuebles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inmuebles, Productos]),
    BitacoraModule,
    TenantFilterModule,
    S3Module,
  ],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activos } from 'src/entities/Activos';
import { Productos } from 'src/entities/Productos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { S3Module } from 'src/s3/s3.module';
import { ActivosController } from './activos.controller';
import { ActivosService } from './activos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activos, Productos]),
    BitacoraModule,
    TenantFilterModule,
    S3Module,
  ],
  controllers: [ActivosController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}

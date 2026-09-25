import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { Licencias } from 'src/entities/Licencias';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { S3Module } from 'src/s3/s3.module';
import { OperadoresController } from './operadores.controller';
import { OperadoresService } from './operadores.service';
import { OperadoresMultipartDocumentsPlaceholderInterceptor } from './operadores-multipart-placeholder.interceptor';
import { LicenciaMultipartPlaceholderInterceptor } from './licencia-multipart-placeholder.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operadores, Usuarios, Licencias]),
    BitacoraModule,
    TenantFilterModule,
    S3Module,
  ],
  controllers: [OperadoresController],
  providers: [
    OperadoresService,
    OperadoresMultipartDocumentsPlaceholderInterceptor,
    LicenciaMultipartPlaceholderInterceptor,
  ],
  exports: [OperadoresService],
})
export class OperadoresModule {}

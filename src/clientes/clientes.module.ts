import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ClientesMultipartDocumentsPlaceholderInterceptor } from './clientes-multipart-placeholder.interceptor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clientes]),
    BitacoraModule,
    S3Module,
  ],
  controllers: [ClientesController],
  providers: [
    ClientesService,
    ClientesMultipartDocumentsPlaceholderInterceptor,
  ],
  exports: [ClientesService],
})
export class ClientesModule {}

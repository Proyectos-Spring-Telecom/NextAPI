import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ClientesMultipartDocumentsPlaceholderInterceptor } from './clientes-multipart-placeholder.interceptor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { S3Module } from 'src/s3/s3.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { WebhookEmitterModule } from 'src/webhook-emitter/webhook-emitter.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clientes]),
    BitacoraModule,
    S3Module,
    TenantFilterModule,
    WebhookEmitterModule,
  ],
  controllers: [ClientesController],
  providers: [
    ClientesService,
    ClientesMultipartDocumentsPlaceholderInterceptor,
  ],
  exports: [ClientesService],
})
export class ClientesModule {}

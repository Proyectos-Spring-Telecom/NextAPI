import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { WebhooksClienteController } from './webhooks-cliente.controller';
import { WebhooksClienteService } from './webhooks-cliente.service';

@Module({
  imports: [HttpModule, TenantFilterModule, BitacoraModule],
  controllers: [WebhooksClienteController],
  providers: [WebhooksClienteService],
  exports: [WebhooksClienteService],
})
export class WebhooksClienteModule {}

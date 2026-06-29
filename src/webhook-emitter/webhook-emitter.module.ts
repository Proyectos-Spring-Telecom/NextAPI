import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { WebhookEmitterService } from './webhook-emitter.service';

@Module({
  imports: [HttpModule, BitacoraModule],
  providers: [WebhookEmitterService],
  exports: [WebhookEmitterService],
})
export class WebhookEmitterModule {}

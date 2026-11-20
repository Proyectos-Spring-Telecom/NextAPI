import { Module } from '@nestjs/common';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { MailModule } from 'src/mail/mail.module';
import { AvisosMasivosWorker } from './avisos-masivos.worker';
import { CorreosController } from './correos.controller';
import { CorreosService } from './correos.service';

/** Correo libre y aviso masivo (docs/front-next.md §35). */
@Module({
  imports: [MailModule, BitacoraModule, TenantFilterModule],
  controllers: [CorreosController],
  providers: [CorreosService, AvisosMasivosWorker],
})
export class CorreosModule {}

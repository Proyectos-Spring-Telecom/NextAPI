import { Module } from '@nestjs/common';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { TelefonosAppController } from './telefonos-app.controller';
import { TelefonosAppService } from './telefonos-app.service';
import { TrackPhoneClient } from './trackphone.client';

/** App de rastreo en teléfonos (springTrackPhone): alta, estado y baja. */
@Module({
  imports: [TenantFilterModule],
  controllers: [TelefonosAppController],
  providers: [TelefonosAppService, TrackPhoneClient],
})
export class TelefonosModule {}

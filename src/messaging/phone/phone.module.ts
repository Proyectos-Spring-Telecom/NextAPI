import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { PhoneEventsConsumer } from './phone-events.consumer';
import { PhoneIngestService } from './phone-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [PhoneIngestService, PhoneEventsConsumer],
  exports: [PhoneIngestService, PhoneEventsConsumer],
})
export class PhoneModule {}

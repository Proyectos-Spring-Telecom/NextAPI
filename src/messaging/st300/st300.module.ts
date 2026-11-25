import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { St300EventsConsumer } from './st300-events.consumer';
import { St300IngestService } from './st300-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [St300IngestService, St300EventsConsumer],
  exports: [St300IngestService, St300EventsConsumer],
})
export class St300Module {}

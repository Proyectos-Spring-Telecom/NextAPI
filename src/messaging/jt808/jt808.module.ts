import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { Jt808EventsConsumer } from './jt808-events.consumer';
import { Jt808IngestService } from './jt808-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [Jt808IngestService, Jt808EventsConsumer],
  exports: [Jt808IngestService, Jt808EventsConsumer],
})
export class Jt808Module {}

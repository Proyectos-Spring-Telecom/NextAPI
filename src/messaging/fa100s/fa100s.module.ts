import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { Fa100sEventsConsumer } from './fa100s-events.consumer';
import { Fa100sIngestService } from './fa100s-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [Fa100sIngestService, Fa100sEventsConsumer],
  exports: [Fa100sIngestService, Fa100sEventsConsumer],
})
export class Fa100sModule {}

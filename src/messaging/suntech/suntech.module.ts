import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { SuntechEventsConsumer } from './suntech-events.consumer';
import { SuntechIngestService } from './suntech-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [SuntechIngestService, SuntechEventsConsumer],
  exports: [SuntechIngestService, SuntechEventsConsumer],
})
export class SuntechModule {}

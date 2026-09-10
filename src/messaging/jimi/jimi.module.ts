import { Module } from '@nestjs/common';
import { MessagingSharedModule } from '../shared/shared.module';
import { JimiEventsConsumer } from './jimi-events.consumer';
import { JimiIngestService } from './jimi-ingest.service';

@Module({
  imports: [MessagingSharedModule],
  providers: [JimiIngestService, JimiEventsConsumer],
  exports: [JimiIngestService, JimiEventsConsumer],
})
export class JimiModule {}

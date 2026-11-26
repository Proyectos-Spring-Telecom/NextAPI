import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { parseSuntechEnvelope } from './suntech-envelope.mapper';
import { SuntechIngestService } from './suntech-ingest.service';

@Injectable()
export class SuntechEventsConsumer {
  private readonly logger = new Logger(SuntechEventsConsumer.name);

  constructor(private readonly ingest: SuntechIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parseSuntechEnvelope(msg.content.toString('utf8'));

    const result = await this.ingest.handleEnvelope(envelope, routingKey);
    if (result.duplicate) {
      this.logger.debug(`suntech duplicado ${envelope.eventId}`);
    } else if (result.audited) {
      this.logger.debug(`suntech alarm auditada ${envelope.eventId} (${routingKey})`);
    }
  }
}

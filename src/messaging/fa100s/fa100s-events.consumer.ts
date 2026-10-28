import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { Fa100sIngestService } from './fa100s-ingest.service';
import { parseFa100sEnvelope } from './fa100s-envelope.mapper';

@Injectable()
export class Fa100sEventsConsumer {
  private readonly logger = new Logger(Fa100sEventsConsumer.name);

  constructor(private readonly ingest: Fa100sIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parseFa100sEnvelope(msg.content.toString('utf8'));

    const result = await this.ingest.handleEnvelope(envelope, routingKey);
    if (result.duplicate) {
      this.logger.debug(`fa100s duplicado ${envelope.eventId}`);
    } else if (result.audited) {
      this.logger.debug(`fa100s alarm auditada ${envelope.eventId} (${routingKey})`);
    }
  }
}

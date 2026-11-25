import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { parseSt300Envelope } from './st300-envelope.mapper';
import { St300IngestService } from './st300-ingest.service';

@Injectable()
export class St300EventsConsumer {
  private readonly logger = new Logger(St300EventsConsumer.name);

  constructor(private readonly ingest: St300IngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parseSt300Envelope(msg.content.toString('utf8'));

    const result = await this.ingest.handleEnvelope(envelope, routingKey);
    if (result.duplicate) {
      this.logger.debug(`st300 duplicado ${envelope.eventId}`);
    } else if (result.audited) {
      this.logger.debug(`st300 alarm auditada ${envelope.eventId} (${routingKey})`);
    }
  }
}

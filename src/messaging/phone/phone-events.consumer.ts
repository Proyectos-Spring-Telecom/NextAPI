import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { PhoneIngestService } from './phone-ingest.service';
import { parsePhoneEnvelope } from './phone-envelope.mapper';

@Injectable()
export class PhoneEventsConsumer {
  private readonly logger = new Logger(PhoneEventsConsumer.name);

  constructor(private readonly ingest: PhoneIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parsePhoneEnvelope(msg.content.toString('utf8'));

    const result = await this.ingest.handleEnvelope(envelope, routingKey);
    if (result.duplicate) {
      this.logger.debug(`phone duplicado ${envelope.eventId}`);
    }
  }
}

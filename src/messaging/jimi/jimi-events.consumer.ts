import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { JimiIngestService } from './jimi-ingest.service';
import { assertJimiEnvelope, parseJimiEnvelope } from './jimi-envelope.mapper';

@Injectable()
export class JimiEventsConsumer {
  private readonly logger = new Logger(JimiEventsConsumer.name);

  constructor(private readonly ingest: JimiIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parseJimiEnvelope(msg.content.toString('utf8'));
    assertJimiEnvelope(envelope);

    if (envelope.kind !== 'position' && envelope.kind !== 'alarm') {
      throw new Error(
        `kind=${envelope.kind} incoherente con cola jimi.events (${routingKey})`,
      );
    }

    const result = await this.ingest.handleEnvelope(envelope, routingKey);
    if (result.duplicate) {
      this.logger.debug(`jimi.events duplicado ${envelope.eventId}`);
    } else if (result.audited) {
      this.logger.debug(
        `jimi.events alarm auditada ${envelope.eventId} (${routingKey})`,
      );
    }
  }
}

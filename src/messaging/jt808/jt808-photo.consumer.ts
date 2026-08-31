import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { Jt808IngestService } from './jt808-ingest.service';
import {
  assertJt808Envelope,
  parseJt808Envelope,
} from './jt808-envelope.mapper';

@Injectable()
export class Jt808PhotoConsumer {
  constructor(private readonly ingest: Jt808IngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;
    const envelope = parseJt808Envelope(msg.content.toString('utf8'));
    assertJt808Envelope(envelope);

    if (envelope.kind !== 'photo') {
      throw new Error(
        `kind=${envelope.kind} incoherente con cola jt808.media (${routingKey})`,
      );
    }

    await this.ingest.handleEnvelope(envelope, routingKey);
  }
}

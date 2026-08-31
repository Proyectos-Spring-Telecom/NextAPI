import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import {
  assertAxproEnvelope,
  parseAxproEnvelope,
} from './axpro-envelope.mapper';
import { AxproIngestService } from './axpro-ingest.service';
import { AxproEventPayload } from './axpro.types';

@Injectable()
export class AxproEventsConsumer {
  constructor(private readonly ingest: AxproIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const envelope = parseAxproEnvelope(msg.content.toString('utf8'));
    assertAxproEnvelope(envelope);
    if (envelope.kind !== 'event') {
      throw new Error('kind incoherente con cola axpro.event');
    }
    await this.ingest.handleEvent(
      envelope as typeof envelope & { payload: AxproEventPayload },
    );
  }
}

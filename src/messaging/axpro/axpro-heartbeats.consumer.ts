import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import {
  assertAxproEnvelope,
  parseAxproEnvelope,
} from './axpro-envelope.mapper';
import { AxproIngestService } from './axpro-ingest.service';
import { AxproHeartbeatPayload } from './axpro.types';

@Injectable()
export class AxproHeartbeatsConsumer {
  constructor(private readonly ingest: AxproIngestService) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const envelope = parseAxproEnvelope(msg.content.toString('utf8'));
    assertAxproEnvelope(envelope);
    if (envelope.kind !== 'heartbeat') {
      throw new Error('kind incoherente con cola axpro.heartbeat');
    }
    await this.ingest.handleHeartbeat(
      envelope as typeof envelope & { payload: AxproHeartbeatPayload },
    );
  }
}

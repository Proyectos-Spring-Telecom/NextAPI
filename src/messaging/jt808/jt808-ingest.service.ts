import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import { isDuplicateKeyError } from '../core/db-errors.util';
import {
  extractJt808Audit,
  mapAcometidasToPosicion,
} from './jt808-envelope.mapper';
import { Jt808TelemetryEnvelope } from './jt808.types';

@Injectable()
export class Jt808IngestService {
  private readonly logger = new Logger(Jt808IngestService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly deviceLookup: DeviceLookupService,
  ) {}

  async handleEnvelope(
    envelope: Jt808TelemetryEnvelope,
    routingKey: string,
  ): Promise<{ posicionId?: number; duplicate?: boolean }> {
    let imei: number;
    try {
      ({ imei } = await this.deviceLookup.resolve(envelope.deviceId));
    } catch (error) {
      if (
        error instanceof DeviceNotFoundError ||
        error instanceof DeviceImeiMissingError
      ) {
        this.logger.warn((error as Error).message);
        return {};
      }
      throw error;
    }

    const auditPayload = extractJt808Audit(envelope.payload);
    const posicionData = mapAcometidasToPosicion(imei, envelope.payload);

    return this.dataSource.transaction(async (manager) => {
      try {
        await manager.insert(TelemetryIngestLog, {
          eventId: envelope.eventId,
          protocol: envelope.protocol,
          kind: envelope.kind,
          deviceId: envelope.deviceId,
          routingKey,
          payloadJson: auditPayload ?? undefined,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return { duplicate: true };
        }
        throw error;
      }

      const insertResult = await manager.insert(Posiciones, posicionData);
      const posicionId = Number(insertResult.identifiers[0]?.id);

      await manager.update(
        TelemetryIngestLog,
        { eventId: envelope.eventId },
        { posicionId },
      );

      this.logger.log(
        `[Jt808Ingest] ${envelope.kind} eventId=${envelope.eventId} deviceId=${envelope.deviceId} → PosicionId=${posicionId}`,
      );

      return { posicionId };
    });
  }
}

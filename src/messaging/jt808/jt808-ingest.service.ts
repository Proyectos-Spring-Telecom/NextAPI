import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import {
  extractJt808Audit,
  mapAcometidasToPosicion,
} from './jt808-envelope.mapper';
import { Jt808TelemetryEnvelope } from './jt808.types';

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code === 'ER_DUP_ENTRY'
  );
}

@Injectable()
export class Jt808IngestService {
  private readonly logger = new Logger(Jt808IngestService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly deviceLookup: DeviceLookupService,
    @InjectRepository(TelemetryIngestLog)
    private readonly ingestLogRepo: Repository<TelemetryIngestLog>,
  ) {}

  async handleEnvelope(
    envelope: Jt808TelemetryEnvelope,
    routingKey: string,
  ): Promise<{ posicionId?: number; duplicate?: boolean }> {
    const existing = await this.ingestLogRepo.findOne({
      where: { eventId: envelope.eventId },
      select: ['id'],
    });
    if (existing) {
      this.logger.debug(
        `JT808 duplicado eventId=${envelope.eventId} kind=${envelope.kind}`,
      );
      return { duplicate: true };
    }

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

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      try {
        await qr.manager.insert(TelemetryIngestLog, {
          eventId: envelope.eventId,
          protocol: envelope.protocol,
          kind: envelope.kind,
          deviceId: envelope.deviceId,
          routingKey,
          payloadJson: auditPayload ?? undefined,
        });
      } catch (error) {
        if (isDuplicateKey(error)) {
          await qr.rollbackTransaction();
          return { duplicate: true };
        }
        throw error;
      }

      const insertResult = await qr.manager.insert(Posiciones, posicionData);
      const posicionId = Number(insertResult.identifiers[0]?.id);

      await qr.manager.update(
        TelemetryIngestLog,
        { eventId: envelope.eventId },
        { posicionId },
      );

      await qr.commitTransaction();

      this.logger.log(
        `[Jt808Ingest] ${envelope.kind} eventId=${envelope.eventId} deviceId=${envelope.deviceId} → PosicionId=${posicionId}`,
      );

      return { posicionId };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}

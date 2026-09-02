import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
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
    private readonly monitoreoGateway: MonitoreoGateway,
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

    const result = await this.dataSource.transaction(async (manager) => {
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
          return { duplicate: true as const };
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

      await this.upsertUltimaPosicion(manager, imei, posicionData);

      this.logger.log(
        `[Jt808Ingest] ${envelope.kind} eventId=${envelope.eventId} deviceId=${envelope.deviceId} → PosicionId=${posicionId}`,
      );

      return { posicionId };
    });

    if (!result.duplicate && result.posicionId != null) {
      void this.monitoreoGateway.notificarImei(imei);
    }

    return result;
  }

  private async upsertUltimaPosicion(
    manager: EntityManager,
    imei: number,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    await manager.upsert(
      UltimaPosicion,
      {
        imei,
        lat: posicionData.lat,
        lng: posicionData.lng,
        estado: posicionData.estado ?? null,
        fechaHora: posicionData.fechaHora,
        velocidad: posicionData.velocidad ?? 0,
        direccion: posicionData.direccion ?? 0,
        odometro: posicionData.odometro ?? null,
        ignicion: posicionData.ignicion ?? null,
        alarma1: posicionData.alarma1 ?? null,
        alarma2: posicionData.alarma2 ?? null,
        energia: posicionData.energia ?? null,
        idEvento: posicionData.idEvento ?? null,
        idFoto: posicionData.idFoto ?? null,
        bateria: posicionData.bateria ?? null,
        alimentacion: posicionData.alimentacion ?? null,
        gps: posicionData.gps ?? null,
        gsm: posicionData.gsm ?? null,
        movimiento: posicionData.movimiento ?? null,
        combustible: posicionData.combustible ?? null,
        foto1: posicionData.foto1 ?? null,
        foto2: posicionData.foto2 ?? null,
        foto3: posicionData.foto3 ?? null,
        video1: posicionData.video1 ?? null,
        video2: posicionData.video2 ?? null,
        video3: posicionData.video3 ?? null,
      },
      ['imei'],
    );
  }
}

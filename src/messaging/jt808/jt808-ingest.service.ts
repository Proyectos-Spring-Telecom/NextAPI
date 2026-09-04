import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Fotos } from 'src/entities/Fotos';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { Videos } from 'src/entities/Videos';
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
import {
  AcometidasPayload,
  Jt808PhotoExtension,
  Jt808TelemetryEnvelope,
} from './jt808.types';

/**
 * Consume telemetría JT808 → INSERT Posiciones (Estado NULL).
 * UltimaPosicion / Estado / Ignicion (si NULL) los deriva el trigger de BD.
 */
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
    let imei: string;
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

      await this.attachMediaIds(manager, imei, envelope.payload, posicionData);

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

    if (!result.duplicate && result.posicionId != null) {
      void this.monitoreoGateway.notificarImei(imei);
    }

    return result;
  }

  /**
   * Orden FK: INSERT Fotos/Videos desde URLs Foto1..3 / Video1..3 → IdFoto1..3 / IdVideo1..3.
   * - payload.IdFoto / jt808.multimediaId = multimedia JT808 → se guarda en Fotos.IdFoto (no es FK).
   * - Posiciones.IdFoto (legacy) se deja NULL; no copiar IdFoto1.
   */
  private async attachMediaIds(
    manager: EntityManager,
    imei: string,
    payload: AcometidasPayload,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    const fechaHora = posicionData.fechaHora ?? null;
    const jt808 = payload.jt808 as Jt808PhotoExtension | undefined;
    const filePaths = jt808?.filePaths ?? [];
    const singlePath = jt808?.filePath ?? null;
    /** Solo para columna Fotos.IdFoto (multimedia cámara); nunca como FK de Posiciones */
    const multimediaJt808 =
      payload.IdFoto != null
        ? Number(payload.IdFoto)
        : jt808?.multimediaId != null
          ? Number(jt808.multimediaId)
          : null;

    const idFoto1 = await this.insertFotoIfUrl(manager, {
      imei,
      url: payload.Foto1,
      fechaHora,
      idFotoJt808: multimediaJt808,
      rutaServidor: filePaths[0] ?? singlePath,
    });
    const idFoto2 = await this.insertFotoIfUrl(manager, {
      imei,
      url: payload.Foto2,
      fechaHora,
      idFotoJt808: null,
      rutaServidor: filePaths[1] ?? null,
    });
    const idFoto3 = await this.insertFotoIfUrl(manager, {
      imei,
      url: payload.Foto3,
      fechaHora,
      idFotoJt808: null,
      rutaServidor: filePaths[2] ?? null,
    });

    const idVideo1 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video1,
      fechaHora,
      rutaServidor:
        !payload.Foto1 && !payload.Foto2 && !payload.Foto3
          ? (filePaths[0] ?? singlePath)
          : null,
    });
    const idVideo2 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video2,
      fechaHora,
      rutaServidor: filePaths[1] ?? null,
    });
    const idVideo3 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video3,
      fechaHora,
      rutaServidor: filePaths[2] ?? null,
    });

    posicionData.idFoto1 = idFoto1;
    posicionData.idFoto2 = idFoto2;
    posicionData.idFoto3 = idFoto3;
    posicionData.idVideo1 = idVideo1;
    posicionData.idVideo2 = idVideo2;
    posicionData.idVideo3 = idVideo3;
    posicionData.idFoto = null;
  }

  private async insertFotoIfUrl(
    manager: EntityManager,
    args: {
      imei: string;
      url: string | null | undefined;
      fechaHora: Date | null;
      idFotoJt808: number | null;
      rutaServidor: string | null;
    },
  ): Promise<number | null> {
    const ruta = args.url?.trim();
    if (!ruta) return null;

    const result = await manager.insert(Fotos, {
      imei: args.imei,
      idFoto: args.idFotoJt808,
      ruta,
      rutaServidor: args.rutaServidor,
      fechaHora: args.fechaHora,
    });
    return Number(result.identifiers[0]?.id);
  }

  private async insertVideoIfUrl(
    manager: EntityManager,
    args: {
      imei: string;
      url: string | null | undefined;
      fechaHora: Date | null;
      rutaServidor: string | null;
    },
  ): Promise<number | null> {
    const ruta = args.url?.trim();
    if (!ruta) return null;

    const result = await manager.insert(Videos, {
      imei: args.imei,
      ruta,
      rutaServidor: args.rutaServidor,
      fechaHora: args.fechaHora,
    });
    return Number(result.identifiers[0]?.id);
  }
}

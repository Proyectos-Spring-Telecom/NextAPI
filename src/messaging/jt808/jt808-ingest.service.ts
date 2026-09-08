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
  isPublicHttpUrl,
  mapAcometidasToPosicion,
} from './jt808-envelope.mapper';
import {
  AcometidasPayload,
  Jt808PhotoExtension,
  Jt808TelemetryEnvelope,
} from './jt808.types';

/**
 * Consume telemetría JT808 (springTrackCam):
 * - kind=position → INSERT Posiciones (+ media URLs) → WS
 * - kind=alarm → solo TelemetryIngestLog (NO Posiciones; evita GPS duplicado)
 * Estado e Ignicion vienen del gateway; el trigger solo completa si van NULL.
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
  ): Promise<{ posicionId?: number; duplicate?: boolean; audited?: boolean }> {
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

    if (envelope.kind === 'alarm') {
      return this.handleAlarm(envelope, routingKey, imei);
    }

    return this.handlePosition(envelope, routingKey, imei);
  }

  /** Whitelist alarm: auditoría / push futuro — sin INSERT Posiciones. */
  private async handleAlarm(
    envelope: Jt808TelemetryEnvelope,
    routingKey: string,
    imei: string,
  ): Promise<{ duplicate?: boolean; audited?: boolean }> {
    const auditPayload = extractJt808Audit(envelope.payload, 'alarm');

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

      this.logger.log(
        `[Jt808Ingest] alarm eventId=${envelope.eventId} deviceId=${envelope.deviceId} imei=${imei} routingKey=${routingKey} (sin Posiciones)`,
      );

      return { audited: true as const };
    });

    return result;
  }

  /** GPS / ACC / media / IdEvento dominante → Posiciones + WS. */
  private async handlePosition(
    envelope: Jt808TelemetryEnvelope,
    routingKey: string,
    imei: string,
  ): Promise<{ posicionId?: number; duplicate?: boolean }> {
    const auditPayload = extractJt808Audit(envelope.payload, envelope.kind);
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
        `[Jt808Ingest] ${envelope.kind} eventId=${envelope.eventId} deviceId=${envelope.deviceId} → PosicionId=${posicionId} Estado=${posicionData.estado ?? 'NULL'}`,
      );

      return { posicionId };
    });

    if (!result.duplicate && result.posicionId != null) {
      void this.monitoreoGateway.notificarImei(imei);
    }

    return result;
  }

  /**
   * Orden FK: INSERT Fotos/Videos desde URLs públicas Foto1..3 / Video1..3.
   * Ignora paths absolutos del gateway (`filePath` / `filePaths`).
   */
  private async attachMediaIds(
    manager: EntityManager,
    imei: string,
    payload: AcometidasPayload,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    const fechaHora = posicionData.fechaHora ?? null;
    const jt808 = payload.jt808 as Jt808PhotoExtension | undefined;
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
    });
    const idFoto2 = await this.insertFotoIfUrl(manager, {
      imei,
      url: payload.Foto2,
      fechaHora,
      idFotoJt808: null,
    });
    const idFoto3 = await this.insertFotoIfUrl(manager, {
      imei,
      url: payload.Foto3,
      fechaHora,
      idFotoJt808: null,
    });

    const idVideo1 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video1,
      fechaHora,
    });
    const idVideo2 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video2,
      fechaHora,
    });
    const idVideo3 = await this.insertVideoIfUrl(manager, {
      imei,
      url: payload.Video3,
      fechaHora,
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
    },
  ): Promise<number | null> {
    if (!isPublicHttpUrl(args.url)) return null;
    const ruta = args.url!.trim();

    const result = await manager.insert(Fotos, {
      imei: args.imei,
      idFoto: args.idFotoJt808,
      ruta,
      rutaServidor: null,
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
    },
  ): Promise<number | null> {
    if (!isPublicHttpUrl(args.url)) return null;
    const ruta = args.url!.trim();

    const result = await manager.insert(Videos, {
      imei: args.imei,
      ruta,
      rutaServidor: null,
      fechaHora: args.fechaHora,
    });
    return Number(result.identifiers[0]?.id);
  }
}

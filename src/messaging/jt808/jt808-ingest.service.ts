import { Injectable, Logger } from '@nestjs/common';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import { PosicionIngestService } from '../shared/posicion-ingest.service';
import {
  extractJt808Audit,
  mapAcometidasToPosicion,
} from './jt808-envelope.mapper';
import { Jt808PhotoExtension, Jt808TelemetryEnvelope } from './jt808.types';

/**
 * Adapter JT808 (springTrackCam) → PosicionIngestService.
 * - kind=position|photo → Posiciones (+ media)
 * - kind=alarm → solo auditoría (NO Posiciones)
 */
@Injectable()
export class Jt808IngestService {
  private readonly logger = new Logger(Jt808IngestService.name);

  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
  ) {}

  async handleEnvelope(
    envelope: Jt808TelemetryEnvelope,
    routingKey: string,
  ): Promise<{ posicionId?: number; duplicate?: boolean; audited?: boolean }> {
    let imei: string;
    let idTipoDispositivo: number;
    let idInstalacion: number | null;
    try {
      ({ imei, idTipoDispositivo, idInstalacion } =
        await this.deviceLookup.resolve(envelope.deviceId));
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
      return this.posicionIngest.ingestAlarm({
        eventId: envelope.eventId,
        protocol: envelope.protocol,
        kind: envelope.kind,
        deviceId: envelope.deviceId,
        routingKey,
        imei,
        idTipoDispositivo,
        idInstalacion,
        auditPayload: extractJt808Audit(envelope.payload, 'alarm'),
      });
    }

    const p = envelope.payload;
    const jt808 = p.jt808 as Jt808PhotoExtension | undefined;
    const multimediaId =
      p.IdFoto != null
        ? Number(p.IdFoto)
        : jt808?.multimediaId != null
          ? Number(jt808.multimediaId)
          : null;

    return this.posicionIngest.ingestPosition({
      eventId: envelope.eventId,
      protocol: envelope.protocol,
      kind: envelope.kind,
      deviceId: envelope.deviceId,
      routingKey,
      imei,
      idTipoDispositivo,
      idInstalacion,
      auditPayload: extractJt808Audit(envelope.payload, envelope.kind),
      posicion: mapAcometidasToPosicion(imei, p),
      media: {
        Foto1: p.Foto1,
        Foto2: p.Foto2,
        Foto3: p.Foto3,
        Video1: p.Video1,
        Video2: p.Video2,
        Video3: p.Video3,
        multimediaId,
      },
    });
  }
}

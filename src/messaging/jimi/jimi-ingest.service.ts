import { Injectable, Logger } from '@nestjs/common';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import { PosicionIngestService } from '../shared/posicion-ingest.service';
import { extractJimiAudit, mapJimiToPosicion } from './jimi-envelope.mapper';
import { JimiTelemetryEnvelope } from './jimi.types';

/**
 * Adapter Jimi / Concox VL802 (springTrackGas) → PosicionIngestService.
 * - kind=position → Posiciones (+ Combustible)
 * - kind=alarm (SOS) → solo auditoría (NO Posiciones)
 */
@Injectable()
export class JimiIngestService {
  private readonly logger = new Logger(JimiIngestService.name);

  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
  ) {}

  async handleEnvelope(
    envelope: JimiTelemetryEnvelope,
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
        auditPayload: extractJimiAudit(envelope.payload, 'alarm'),
      });
    }

    const p = envelope.payload;
    return this.posicionIngest.ingestPosition({
      eventId: envelope.eventId,
      protocol: envelope.protocol,
      kind: envelope.kind,
      deviceId: envelope.deviceId,
      routingKey,
      imei,
      idTipoDispositivo,
      idInstalacion,
      auditPayload: extractJimiAudit(envelope.payload, 'position'),
      posicion: mapJimiToPosicion(imei, p),
      media: {
        Foto1: p.Foto1,
        Foto2: p.Foto2,
        Foto3: p.Foto3,
        Video1: p.Video1,
        Video2: p.Video2,
        Video3: p.Video3,
      },
    });
  }
}

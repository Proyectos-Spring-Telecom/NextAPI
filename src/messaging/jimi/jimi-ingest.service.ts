import { Injectable, Logger } from '@nestjs/common';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundByImeiError,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import { PosicionIngestService } from '../shared/posicion-ingest.service';
import { TelemetriaHuerfanosService } from 'src/telemetria-huerfanos/telemetria-huerfanos.service';
import {
  estadoJimi,
  extractJimiAudit,
  mapJimiToPosicion,
  resolveJimiImei,
} from './jimi-envelope.mapper';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import { JimiTelemetryEnvelope } from './jimi.types';

/**
 * Adapter Jimi / Concox VL802 (springTrackGas) → PosicionIngestService.
 * Lookup por Dispositivos.Imei (payload.Imei || deviceId).
 * - kind=position → Posiciones (+ Combustible)
 * - kind=alarm (SOS) → solo auditoría (NO Posiciones)
 * - position sin GPS válido (Lat/Lng null) → ingestSinUbicacion: no va a
 *   Posiciones; si es alerta abre el incidente sin ubicación
 */
@Injectable()
export class JimiIngestService {
  private readonly logger = new Logger(JimiIngestService.name);

  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
    private readonly huerfanos: TelemetriaHuerfanosService,
  ) {}

  async handleEnvelope(
    envelope: JimiTelemetryEnvelope,
    routingKey: string,
  ): Promise<{ posicionId?: number; duplicate?: boolean; audited?: boolean }> {
    const imeiKey = resolveJimiImei(envelope);

    let imei: string;
    let idTipoDispositivo: number;
    let idInstalacion: number | null;
    let estatusDispositivo: number;
    try {
      ({ imei, idTipoDispositivo, idInstalacion, estatus: estatusDispositivo } =
        await this.deviceLookup.resolveByImei(imeiKey));
    } catch (error) {
      if (
        error instanceof DeviceNotFoundByImeiError ||
        error instanceof DeviceNotFoundError ||
        error instanceof DeviceImeiMissingError
      ) {
        await this.huerfanos.registrar({
          protocol: 'jimi',
          deviceId: imeiKey,
          motivo:
            error instanceof DeviceImeiMissingError ? 'sin_imei' : 'no_registrado',
          routingKey,
          lat: envelope.payload?.Lat,
          lng: envelope.payload?.Lng,
        });
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
        estatusDispositivo,
        auditPayload: extractJimiAudit(envelope.payload, 'alarm'),
      });
    }

    const p = envelope.payload;
    if (p.Lat == null || p.Lng == null) {
      return this.posicionIngest.ingestSinUbicacion({
        eventId: envelope.eventId,
        protocol: envelope.protocol,
        kind: envelope.kind,
        deviceId: envelope.deviceId,
        routingKey,
        imei,
        idTipoDispositivo,
        idInstalacion,
        estatusDispositivo,
        auditPayload: extractJimiAudit(envelope.payload, 'position'),
        alerta: {
          estado: estadoJimi(p.Estado, p.IdEvento),
          idEvento: p.IdEvento != null ? Number(p.IdEvento) : null,
          fechaHora: parseFechaHoraPared(String(p.FechaHora)),
        },
      });
    }

    return this.posicionIngest.ingestPosition({
      eventId: envelope.eventId,
      protocol: envelope.protocol,
      kind: envelope.kind,
      deviceId: envelope.deviceId,
      routingKey,
      imei,
      idTipoDispositivo,
      idInstalacion,
      estatusDispositivo,
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

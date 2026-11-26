import { Injectable } from '@nestjs/common';
import {
  DeviceImeiMissingError,
  DeviceLookupService,
  DeviceNotFoundByImeiError,
  DeviceNotFoundError,
} from '../shared/device-lookup.service';
import { PosicionIngestService } from '../shared/posicion-ingest.service';
import { PosicionIngestResult } from '../shared/posicion-ingest.types';
import { TelemetriaHuerfanosService } from 'src/telemetria-huerfanos/telemetria-huerfanos.service';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import { extractSuntechAudit, mapSuntechToPosicion, resolveSuntechImei } from './suntech-envelope.mapper';
import { SuntechTelemetryEnvelope } from './suntech.types';

/**
 * Adapter Suntech (springSuntech) → PosicionIngestService. Lookup por
 * Dispositivos.Imei (= DEV_ID sin ceros a la izquierda, como los dio de alta el legacy).
 * - position → Posiciones (siempre con fix GPS).
 * - alarm con coordenadas → solo auditoría; la alarma se ve por la posición
 *   con su IdEvento (el socket publica la posición de la misma trama).
 * - alarm sin coordenadas (sin GPS en la trama) → incidente sin ubicación.
 */
@Injectable()
export class SuntechIngestService {
  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
    private readonly huerfanos: TelemetriaHuerfanosService,
  ) {}

  async handleEnvelope(envelope: SuntechTelemetryEnvelope, routingKey: string): Promise<PosicionIngestResult> {
    const imeiKey = resolveSuntechImei(envelope);

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
          protocol: 'suntech',
          deviceId: imeiKey,
          motivo: error instanceof DeviceImeiMissingError ? 'sin_imei' : 'no_registrado',
          routingKey,
          lat: envelope.payload?.Lat,
          lng: envelope.payload?.Lng,
        });
        return {};
      }
      throw error;
    }

    const base = {
      eventId: envelope.eventId,
      protocol: envelope.protocol,
      kind: envelope.kind,
      deviceId: envelope.deviceId,
      routingKey,
      imei,
      idTipoDispositivo,
      idInstalacion,
      estatusDispositivo,
      auditPayload: extractSuntechAudit(envelope.payload),
    };

    if (envelope.kind === 'alarm') {
      const p = envelope.payload;
      if (typeof p.Lat !== 'number' || typeof p.Lng !== 'number') {
        return this.posicionIngest.ingestSinUbicacion({
          ...base,
          alerta: {
            estado: p.Estado != null ? Number(p.Estado) : null,
            idEvento: p.IdEvento != null ? Number(p.IdEvento) : null,
            fechaHora: parseFechaHoraPared(String(p.FechaHora)),
          },
        });
      }
      return this.posicionIngest.ingestAlarm(base);
    }

    return this.posicionIngest.ingestPosition({ ...base, posicion: mapSuntechToPosicion(imei, envelope.payload) });
  }
}

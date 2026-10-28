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
import {
  extractFa100sAudit,
  mapFa100sToPosicion,
  resolveFa100sImei,
} from './fa100s-envelope.mapper';
import { Fa100sTelemetryEnvelope } from './fa100s.types';

/**
 * Adapter relojes FA100S (springFA100S) → PosicionIngestService.
 * Lookup por Dispositivos.Imei, como TrackGas.
 * - position → Posiciones (con la última posición válida si no hubo GPS)
 * - alarm → solo auditoría; la alarma se ve por la posición con su IdEvento
 * - alarm_location → corrige Lat/Lng de la posición de la alarma
 */
@Injectable()
export class Fa100sIngestService {
  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
    private readonly huerfanos: TelemetriaHuerfanosService,
  ) {}

  async handleEnvelope(
    envelope: Fa100sTelemetryEnvelope,
    routingKey: string,
  ): Promise<PosicionIngestResult> {
    const imeiKey = resolveFa100sImei(envelope);

    let imei: string;
    let idTipoDispositivo: number;
    let idInstalacion: number | null;
    try {
      ({ imei, idTipoDispositivo, idInstalacion } =
        await this.deviceLookup.resolveByImei(imeiKey));
    } catch (error) {
      if (
        error instanceof DeviceNotFoundByImeiError ||
        error instanceof DeviceNotFoundError ||
        error instanceof DeviceImeiMissingError
      ) {
        await this.huerfanos.registrar({
          protocol: 'fa100s',
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

    const base = {
      eventId: envelope.eventId,
      protocol: envelope.protocol,
      kind: envelope.kind,
      deviceId: envelope.deviceId,
      routingKey,
      imei,
      idTipoDispositivo,
      idInstalacion,
      auditPayload: extractFa100sAudit(envelope.payload),
    };

    if (envelope.kind === 'alarm') {
      return this.posicionIngest.ingestAlarm(base);
    }

    const posicion = mapFa100sToPosicion(imei, envelope.payload);
    if (envelope.kind === 'alarm_location') {
      return this.posicionIngest.ingestAlarmLocation({ ...base, posicion });
    }
    return this.posicionIngest.ingestPosition({ ...base, posicion });
  }
}

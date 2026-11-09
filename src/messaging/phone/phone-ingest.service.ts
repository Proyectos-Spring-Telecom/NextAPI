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
import { extractPhoneAudit, mapPhoneToPosicion, resolvePhoneImei } from './phone-envelope.mapper';
import { PhoneTelemetryEnvelope } from './phone.types';

/**
 * Adapter de teléfonos (springTrackPhone) → PosicionIngestService. Lookup
 * por Dispositivos.Imei, como relojes y TrackGas; sin alta → huérfano.
 */
@Injectable()
export class PhoneIngestService {
  constructor(
    private readonly deviceLookup: DeviceLookupService,
    private readonly posicionIngest: PosicionIngestService,
    private readonly huerfanos: TelemetriaHuerfanosService,
  ) {}

  async handleEnvelope(envelope: PhoneTelemetryEnvelope, routingKey: string): Promise<PosicionIngestResult> {
    const imeiKey = resolvePhoneImei(envelope);

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
          protocol: 'phone',
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
      auditPayload: extractPhoneAudit(envelope.payload),
      posicion: mapPhoneToPosicion(imei, envelope.payload),
    });
  }
}

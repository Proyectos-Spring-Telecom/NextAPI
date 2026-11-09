import { BadRequestException } from '@nestjs/common';
import { FuentePosicion } from '../../common/fuente-posicion';
import { Posiciones } from '../../entities/Posiciones';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import { PhonePayload, PhoneTelemetryEnvelope } from './phone.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;
const FUENTES = [FuentePosicion.GPS, FuentePosicion.WIFI, FuentePosicion.ANTENA, FuentePosicion.TELEFONO];

export function parsePhoneEnvelope(raw: string): PhoneTelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje phone');
  }
  return assertPhoneEnvelope(parsed);
}

export function assertPhoneEnvelope(value: unknown): PhoneTelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope phone inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '').toLowerCase();
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload as PhonePayload | undefined;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (envelope.protocol !== 'phone') {
    throw new BadRequestException('protocol debe ser phone');
  }
  if (envelope.kind !== 'position') {
    throw new BadRequestException('kind debe ser position');
  }
  if (!deviceId) {
    throw new BadRequestException('deviceId requerido');
  }
  if (!receivedAt) {
    throw new BadRequestException('receivedAt requerido');
  }
  if (!payload || typeof payload !== 'object') {
    throw new BadRequestException('payload requerido');
  }
  if (!payload.FechaHora?.trim()) {
    throw new BadRequestException('payload FechaHora requerido');
  }
  if (typeof payload.IdEvento !== 'number') {
    throw new BadRequestException('payload IdEvento requerido');
  }
  // Solo coordenadas medidas: una posición sin Lat/Lng es un error del socket.
  if (typeof payload.Lat !== 'number' || typeof payload.Lng !== 'number') {
    throw new BadRequestException('payload Lat/Lng requeridos');
  }
  if (!FUENTES.includes(Number(payload.FuentePosicion))) {
    throw new BadRequestException('payload FuentePosicion inválido (0, 1, 2 o 4)');
  }

  return { eventId, protocol: 'phone', kind: 'position', deviceId, receivedAt, payload };
}

/** IMEI del teléfono: deviceId del envelope (o payload.Imei). */
export function resolvePhoneImei(envelope: PhoneTelemetryEnvelope): string {
  return String(envelope.deviceId || envelope.payload.Imei || '').trim();
}

/** Payload del teléfono → fila de Posiciones (sin ignición, odómetro ni satélites). */
export function mapPhoneToPosicion(imei: string, p: PhonePayload): Partial<Posiciones> {
  const n = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  const radio = Number(p.RadioM);
  return {
    imei,
    lat: Number(p.Lat),
    lng: Number(p.Lng),
    estado: p.Estado != null ? Number(p.Estado) : null,
    fechaHora: parseFechaHoraPared(String(p.FechaHora)),
    velocidad: n(p.Velocidad) ?? 0,
    direccion: n(p.Direccion) ?? 0,
    odometro: null,
    ignicion: 0,
    alarma1: null,
    alarma2: null,
    energia: null,
    idEvento: p.IdEvento,
    idFoto: null,
    bateria: p.Bateria ?? null,
    alimentacion: p.Alimentacion ?? null,
    gps: null,
    gsm: n(p.GSM),
    movimiento: p.Movimiento ?? null,
    combustible: null,
    idFoto1: null,
    idFoto2: null,
    idFoto3: null,
    idVideo1: null,
    idVideo2: null,
    idVideo3: null,
    fuentePosicion: Number(p.FuentePosicion),
    radioM: Number.isFinite(radio) && radio > 0 ? Math.min(65535, Math.round(radio)) : null,
  };
}

/** Auditoría para TelemetryIngestLog. */
export function extractPhoneAudit(p: PhonePayload): unknown {
  return {
    IdEvento: p.IdEvento,
    Bateria: p.Bateria,
    FuentePosicion: p.FuentePosicion,
    RadioM: p.RadioM,
    positionValid: p.positionValid ?? null,
    phone: p.phone ?? null,
  };
}

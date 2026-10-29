import { BadRequestException } from '@nestjs/common';
import { fuentePosicionDe } from '../../common/fuente-posicion';
import { Posiciones } from '../../entities/Posiciones';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import {
  Fa100sKind,
  Fa100sPayload,
  Fa100sTelemetryEnvelope,
} from './fa100s.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;
const KINDS: readonly Fa100sKind[] = ['position', 'alarm', 'alarm_location'];

export function parseFa100sEnvelope(raw: string): Fa100sTelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje FA100S');
  }
  return assertFa100sEnvelope(parsed);
}

export function assertFa100sEnvelope(value: unknown): Fa100sTelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope FA100S inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '').toLowerCase();
  const kind = envelope.kind as Fa100sKind;
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload as Fa100sPayload | undefined;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (envelope.protocol !== 'fa100s') {
    throw new BadRequestException('protocol debe ser fa100s');
  }
  if (!KINDS.includes(kind)) {
    throw new BadRequestException('kind debe ser position, alarm o alarm_location');
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
  // La alarma puede llegar sin coordenadas; posición y ubicación de alarma no.
  if (
    kind !== 'alarm' &&
    (typeof payload.Lat !== 'number' || typeof payload.Lng !== 'number')
  ) {
    throw new BadRequestException(`payload Lat/Lng requeridos en ${kind}`);
  }
  if (kind === 'alarm_location' && !EVENT_ID_RE.test(String(payload.alarmEventId ?? ''))) {
    throw new BadRequestException('alarm_location requiere alarmEventId');
  }

  return { eventId, protocol: 'fa100s', kind, deviceId, receivedAt, payload };
}

/** IMEI del reloj: deviceId del envelope (o payload.Imei). */
export function resolveFa100sImei(envelope: Fa100sTelemetryEnvelope): string {
  return String(envelope.deviceId || envelope.payload.Imei || '').trim();
}

/** Payload FA100S → fila de Posiciones (el reloj no tiene ignición ni odómetro). */
export function mapFa100sToPosicion(
  imei: string,
  p: Fa100sPayload,
): Partial<Posiciones> {
  const n = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  return {
    imei,
    lat: Number(p.Lat),
    lng: Number(p.Lng),
    estado: p.Estado != null ? Number(p.Estado) : null,
    fechaHora: parseFechaHoraPared(String(p.FechaHora)),
    velocidad: n(p.Velocidad) ?? 0,
    direccion: n(p.Direccion) ?? 0,
    odometro: null,
    ignicion: p.Ignicion ?? 0,
    alarma1: p.Alarma1 ?? null,
    alarma2: null,
    energia: null,
    idEvento: p.IdEvento,
    idFoto: null,
    bateria: p.Bateria ?? null,
    alimentacion: null,
    gps: n(p.GPS),
    gsm: n(p.GSM),
    movimiento: p.Movimiento ?? null,
    combustible: null,
    idFoto1: null,
    idFoto2: null,
    idFoto3: null,
    idVideo1: null,
    idVideo2: null,
    idVideo3: null,
    ...fuenteYRadio(p),
  };
}

/**
 * Origen y radio de la ubicación. Campos raíz del socket; si faltan (socket
 * anterior), se deducen de `fa100s.positionSource` / `fa100s.approxRadiusM`.
 */
export function fuenteYRadio(
  p: Fa100sPayload,
): Pick<Posiciones, 'fuentePosicion' | 'radioM'> {
  const meta = p.fa100s ?? {};
  const fuente =
    p.FuentePosicion != null && Number.isInteger(Number(p.FuentePosicion))
      ? Number(p.FuentePosicion)
      : fuentePosicionDe(meta.positionSource);
  const radio = Number(p.RadioM ?? meta.approxRadiusM);
  return {
    fuentePosicion: fuente,
    radioM:
      Number.isFinite(radio) && radio > 0 ? Math.min(65535, Math.round(radio)) : null,
  };
}

/** Auditoría para TelemetryIngestLog. */
export function extractFa100sAudit(p: Fa100sPayload): unknown {
  return {
    IdEvento: p.IdEvento,
    Estado: p.Estado,
    Alarma1: p.Alarma1,
    Bateria: p.Bateria,
    positionValid: p.positionValid ?? null,
    alarmEventId: p.alarmEventId ?? null,
    fa100s: p.fa100s ?? null,
  };
}

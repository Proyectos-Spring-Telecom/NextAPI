import { BadRequestException } from '@nestjs/common';
import { Posiciones } from '../../entities/Posiciones';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import { St300Kind, St300Payload, St300TelemetryEnvelope } from './st300.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;
const KINDS: readonly St300Kind[] = ['position', 'alarm'];

export function parseSt300Envelope(raw: string): St300TelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje ST300');
  }
  return assertSt300Envelope(parsed);
}

export function assertSt300Envelope(value: unknown): St300TelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope ST300 inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '').toLowerCase();
  const kind = envelope.kind as St300Kind;
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload as St300Payload | undefined;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (envelope.protocol !== 'st300') {
    throw new BadRequestException('protocol debe ser st300');
  }
  if (!KINDS.includes(kind)) {
    throw new BadRequestException('kind debe ser position o alarm');
  }
  if (!deviceId) throw new BadRequestException('deviceId requerido');
  if (!receivedAt) throw new BadRequestException('receivedAt requerido');
  if (!payload || typeof payload !== 'object') {
    throw new BadRequestException('payload requerido');
  }
  if (!payload.FechaHora?.trim()) {
    throw new BadRequestException('payload FechaHora requerido');
  }
  if (typeof payload.IdEvento !== 'number') {
    throw new BadRequestException('payload IdEvento requerido');
  }
  // Solo coordenadas medidas: la posición siempre las trae; la alarma puede no.
  if (kind === 'position' && (typeof payload.Lat !== 'number' || typeof payload.Lng !== 'number')) {
    throw new BadRequestException('payload Lat/Lng requeridos en position');
  }
  return { eventId, protocol: 'st300', kind, deviceId, receivedAt, payload };
}

/** DEV_ID del equipo: deviceId del envelope (o payload.Imei). */
export function resolveSt300Imei(envelope: St300TelemetryEnvelope): string {
  return String(envelope.deviceId || envelope.payload.Imei || '').trim();
}

/** Payload ST300 → fila de Posiciones (siempre GPS: FuentePosicion 0). */
export function mapSt300ToPosicion(imei: string, p: St300Payload): Partial<Posiciones> {
  const n = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  return {
    imei,
    lat: Number(p.Lat),
    lng: Number(p.Lng),
    estado: p.Estado != null ? Number(p.Estado) : null,
    fechaHora: parseFechaHoraPared(String(p.FechaHora)),
    velocidad: n(p.Velocidad) ?? 0,
    direccion: n(p.Direccion) ?? 0,
    odometro: n(p.Odometro),
    ignicion: p.Ignicion ?? 0,
    alarma1: p.Alarma1 ?? null,
    alarma2: null,
    energia: null,
    idEvento: p.IdEvento,
    idFoto: null,
    bateria: null,
    alimentacion: p.Alimentacion ?? null,
    gps: n(p.GPS),
    gsm: null,
    movimiento: p.Movimiento ?? null,
    combustible: null,
    idFoto1: null,
    idFoto2: null,
    idFoto3: null,
    idVideo1: null,
    idVideo2: null,
    idVideo3: null,
    fuentePosicion: 0,
    radioM: null,
  };
}

/** Auditoría para TelemetryIngestLog. */
export function extractSt300Audit(p: St300Payload): unknown {
  return {
    IdEvento: p.IdEvento,
    Estado: p.Estado,
    Alarma1: p.Alarma1,
    positionValid: p.positionValid ?? null,
    st300: p.st300 ?? null,
  };
}

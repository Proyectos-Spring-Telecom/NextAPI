import { BadRequestException } from '@nestjs/common';
import { Posiciones } from '../../entities/Posiciones';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import { SuntechKind, SuntechPayload, SuntechTelemetryEnvelope } from './suntech.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;
const KINDS: readonly SuntechKind[] = ['position', 'alarm'];

export function parseSuntechEnvelope(raw: string): SuntechTelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje Suntech');
  }
  return assertSuntechEnvelope(parsed);
}

export function assertSuntechEnvelope(value: unknown): SuntechTelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope Suntech inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '').toLowerCase();
  const kind = envelope.kind as SuntechKind;
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload as SuntechPayload | undefined;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (envelope.protocol !== 'suntech') {
    throw new BadRequestException('protocol debe ser suntech');
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
  return { eventId, protocol: 'suntech', kind, deviceId, receivedAt, payload };
}

/** DEV_ID del equipo: deviceId del envelope (o payload.Imei). */
export function resolveSuntechImei(envelope: SuntechTelemetryEnvelope): string {
  return String(envelope.deviceId || envelope.payload.Imei || '').trim();
}

/** Payload Suntech → fila de Posiciones (siempre GPS: FuentePosicion 0). */
export function mapSuntechToPosicion(imei: string, p: SuntechPayload): Partial<Posiciones> {
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
export function extractSuntechAudit(p: SuntechPayload): unknown {
  return {
    IdEvento: p.IdEvento,
    Estado: p.Estado,
    Alarma1: p.Alarma1,
    positionValid: p.positionValid ?? null,
    suntech: p.suntech ?? null,
  };
}

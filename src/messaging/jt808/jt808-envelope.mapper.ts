import { BadRequestException } from '@nestjs/common';
import { EnumCatEventos } from '../../common/cat-eventos.enum';
import { Posiciones } from '../../entities/Posiciones';
import {
  AcometidasPayload,
  Jt808Kind,
  Jt808TelemetryEnvelope,
} from './jt808.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;

export function parseJt808Envelope(raw: string): Jt808TelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje JT808');
  }
  return assertJt808Envelope(parsed);
}

export function assertJt808Envelope(value: unknown): Jt808TelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope JT808 inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '').toLowerCase();
  const protocol = envelope.protocol;
  const kind = envelope.kind;
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (protocol !== 'jt808') {
    throw new BadRequestException('protocol debe ser jt808');
  }
  if (kind !== 'position' && kind !== 'alarm' && kind !== 'photo') {
    throw new BadRequestException('kind debe ser position, alarm o photo');
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

  assertAcometidasPayload(payload as AcometidasPayload, kind as Jt808Kind);

  return {
    eventId,
    protocol: 'jt808',
    kind: kind as Jt808Kind,
    deviceId,
    receivedAt,
    payload: payload as AcometidasPayload,
  };
}

function assertAcometidasPayload(payload: AcometidasPayload, kind: Jt808Kind) {
  if (typeof payload.Lat !== 'number' || typeof payload.Lng !== 'number') {
    throw new BadRequestException('payload Lat/Lng requeridos');
  }
  if (!payload.FechaHora?.trim()) {
    throw new BadRequestException('payload FechaHora requerido');
  }
  if (typeof payload.IdEvento !== 'number') {
    throw new BadRequestException('payload IdEvento requerido');
  }
  if (kind === 'photo' && payload.IdEvento !== EnumCatEventos.CAMERA) {
    throw new BadRequestException(
      `photo debe traer IdEvento=${EnumCatEventos.CAMERA} (Camera)`,
    );
  }
}

/**
 * Mapea telemetría GPS/evento a Posiciones.
 * - Estado siempre NULL (lo deriva el trigger → UltimaPosicion).
 * - Ignicion: 0|1 si el gateway lo conoce; NULL → el trigger completa.
 * - IdFoto1..3 / IdVideo1..3: el ingest inserta Fotos/Videos y rellena FKs.
 */
export function mapAcometidasToPosicion(
  imei: string,
  aco: AcometidasPayload,
): Partial<Posiciones> {
  return {
    imei,
    lat: aco.Lat,
    lng: aco.Lng,
    estado: null,
    fechaHora: aco.FechaHora as unknown as Date,
    velocidad: Math.round(Number(aco.Velocidad)) || 0,
    direccion: Math.round(Number(aco.Direccion)) || 0,
    odometro: aco.Odometro != null ? Math.round(Number(aco.Odometro)) : null,
    ignicion: aco.Ignicion,
    alarma1: aco.Alarma1,
    alarma2: aco.Alarma2,
    energia: aco.Energia,
    idEvento: aco.IdEvento,
    idFoto: null,
    bateria: aco.Bateria,
    alimentacion: aco.Alimentacion,
    gps: aco.GPS != null ? Math.round(Number(aco.GPS)) : null,
    gsm: aco.GSM != null ? Math.round(Number(aco.GSM)) : null,
    movimiento: aco.Movimiento,
    combustible: aco.Combustible,
    idFoto1: null,
    idFoto2: null,
    idFoto3: null,
    idVideo1: null,
    idVideo2: null,
    idVideo3: null,
  };
}

export function extractJt808Audit(payload: AcometidasPayload): unknown {
  return payload.jt808 ?? null;
}

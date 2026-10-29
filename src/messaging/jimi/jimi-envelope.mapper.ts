import { BadRequestException } from '@nestjs/common';
import { EnumCatEventos } from '../../common/cat-eventos.enum';
import { Posiciones } from '../../entities/Posiciones';
import { imeiToString } from '../../common/imei.util';
import { parseFechaHoraPared } from '../shared/fecha-hora-pared.util';
import {
  JimiAcometidasPayload,
  JimiKind,
  JimiTelemetryEnvelope,
} from './jimi.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;

export function parseJimiEnvelope(raw: string): JimiTelemetryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje Jimi');
  }
  return assertJimiEnvelope(parsed);
}

export function assertJimiEnvelope(value: unknown): JimiTelemetryEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope Jimi inválido');
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
  if (protocol !== 'jimi') {
    throw new BadRequestException('protocol debe ser jimi');
  }
  if (kind !== 'position' && kind !== 'alarm') {
    throw new BadRequestException('kind debe ser position o alarm');
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

  assertJimiPayload(payload as JimiAcometidasPayload, kind as JimiKind);

  return {
    eventId,
    protocol: 'jimi',
    kind: kind as JimiKind,
    deviceId,
    receivedAt,
    payload: payload as JimiAcometidasPayload,
  };
}

function assertJimiPayload(payload: JimiAcometidasPayload, kind: JimiKind) {
  if (typeof payload.IdEvento !== 'number') {
    throw new BadRequestException('payload IdEvento requerido');
  }

  if (kind === 'position') {
    if (typeof payload.Lat !== 'number' || typeof payload.Lng !== 'number') {
      throw new BadRequestException('payload Lat/Lng requeridos');
    }
    if (!payload.FechaHora?.trim()) {
      throw new BadRequestException('payload FechaHora requerido');
    }
  }

  if (kind === 'alarm') {
    const code = String(payload.jimi?.code ?? '').toUpperCase();
    if (code !== 'SOS') {
      throw new BadRequestException(
        `jimi.alarm solo admite code=SOS (recibido: ${payload.jimi?.code ?? 'vacío'})`,
      );
    }
  }
}

/**
 * IMEI de negocio Jimi: preferir `payload.Imei`, fallback `deviceId` (mensajes legacy).
 */
export function resolveJimiImei(envelope: JimiTelemetryEnvelope): string {
  const fromPayload = imeiToString(envelope.payload?.Imei);
  if (fromPayload) {
    return fromPayload;
  }
  const fromDeviceId = String(envelope.deviceId ?? '').trim();
  if (fromDeviceId) {
    return fromDeviceId;
  }
  throw new BadRequestException('IMEI ausente en envelope jimi');
}

/**
 * Estado de alerta que exige cada IdEvento (misma regla que springTrackGas,
 * springTrackCam y los relojes). Server_Socket (AVL legacy) manda el SOS con
 * Estado 0/1 —la base legacy lo corrige con un trigger—; sin esto no se ve
 * como alerta ni abre incidente (28/10/2026: 5 SOS en 7 días).
 */
const ESTADO_POR_EVENTO: Readonly<Record<number, number>> = {
  [EnumCatEventos.HELP_ME]: 2,
  [EnumCatEventos.ENERGY_ALARM]: 10,
  [EnumCatEventos.BATERIA_BAJA]: 9,
};

/** Solo corrige estados de circulación (null, 0, 1); una alerta ya puesta se respeta. */
export function estadoJimi(
  estado: unknown,
  idEvento: unknown,
): number | null {
  const actual = estado != null ? Number(estado) : null;
  const exigido = ESTADO_POR_EVENTO[Number(idEvento)];
  if (exigido != null && (actual == null || actual === 0 || actual === 1)) {
    return exigido;
  }
  return actual;
}

/**
 * Mapea payload Jimi → Posiciones.
 * Estado/Ignicion del gateway tal cual (no forzar NULL), salvo SOS, energía y
 * batería sin estado de alerta (estadoJimi).
 * Combustible: litros float (columna MySQL float).
 */
export function mapJimiToPosicion(
  imei: string,
  aco: JimiAcometidasPayload,
): Partial<Posiciones> {
  return {
    imei,
    lat: aco.Lat,
    lng: aco.Lng,
    estado: estadoJimi(aco.Estado, aco.IdEvento),
    fechaHora: parseFechaHoraPared(String(aco.FechaHora)),
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
    combustible:
      aco.Combustible != null && Number.isFinite(Number(aco.Combustible))
        ? Number(aco.Combustible)
        : null,
    idFoto1: null,
    idFoto2: null,
    idFoto3: null,
    idVideo1: null,
    idVideo2: null,
    idVideo3: null,
  };
}

export function extractJimiAudit(
  payload: JimiAcometidasPayload,
  kind?: JimiKind,
): unknown {
  if (kind === 'alarm') {
    return {
      IdEvento: payload.IdEvento,
      Estado: payload.Estado,
      Alarma1: payload.Alarma1,
      Ignicion: payload.Ignicion,
      Imei: payload.Imei,
      jimi: payload.jimi
        ? {
            source: payload.jimi.source,
            code: payload.jimi.code,
            label: payload.jimi.label,
            protocol: payload.jimi.protocol,
          }
        : null,
    };
  }

  return {
    jimi: payload.jimi ?? null,
    Combustible: payload.Combustible,
    Imei: payload.Imei,
  };
}

import { BadRequestException } from '@nestjs/common';
import { IngestEventoDto } from '../../alarmas/dto/ingest-evento.dto';
import { IngestHeartbeatDto } from '../../alarmas/dto/ingest-heartbeat.dto';
import { etiquetaTipoEvento } from '../../alarmas/sia/sia-codes.map';
import {
  AxproEventPayload,
  AxproHeartbeatPayload,
  AxproTelemetryEnvelope,
} from './axpro.types';

const EVENT_ID_RE = /^[a-fA-F0-9]{64}$/;

export function parseAxproEnvelope(
  raw: string,
): AxproTelemetryEnvelope<AxproEventPayload | AxproHeartbeatPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('JSON inválido en mensaje AX PRO');
  }
  return assertAxproEnvelope(parsed);
}

export function assertAxproEnvelope(
  value: unknown,
): AxproTelemetryEnvelope<AxproEventPayload | AxproHeartbeatPayload> {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('Envelope AX PRO inválido');
  }
  const envelope = value as Record<string, unknown>;
  const eventId = String(envelope.eventId ?? '');
  const protocol = envelope.protocol;
  const kind = envelope.kind;
  const deviceId = String(envelope.deviceId ?? '').trim();
  const receivedAt = String(envelope.receivedAt ?? '');
  const payload = envelope.payload;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new BadRequestException('eventId inválido (se espera SHA-256 hex 64)');
  }
  if (protocol !== 'axpro') {
    throw new BadRequestException('protocol debe ser axpro');
  }
  if (kind !== 'event' && kind !== 'heartbeat') {
    throw new BadRequestException('kind debe ser event o heartbeat');
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

  return {
    eventId,
    protocol: 'axpro',
    kind,
    deviceId,
    receivedAt,
    payload: payload as AxproEventPayload | AxproHeartbeatPayload,
  };
}

export function mapAxproEventToIngestDto(
  envelope: AxproTelemetryEnvelope<AxproEventPayload>,
  dataDescifrada?: string | null,
): IngestEventoDto {
  const payload = envelope.payload;
  if (payload.codigoSia?.toUpperCase() === 'RP') {
    throw new BadRequestException('RP no debe llegar por cola axpro.event');
  }

  const tipoEvento = String(payload.tipoEvento ?? 'desconocido');
  return {
    cuentaSia: envelope.deviceId,
    codigoSia: String(payload.codigoSia ?? ''),
    tipoEvento,
    tipoEventoEtiqueta:
      payload.tipoEventoEtiqueta?.trim() || etiquetaTipoEvento(tipoEvento),
    severidad: Number(payload.severidad ?? 1),
    esRestauracion: Boolean(payload.esRestauracion),
    esHeartbeat: false,
    zona: payload.zona ?? null,
    codigoUsuario: payload.codigoUsuario ?? null,
    nombreDispositivo: payload.nombreDispositivo ?? null,
    particion: payload.particion ?? null,
    seq: String(payload.seq ?? '0000'),
    recibidoEn: envelope.receivedAt,
    timestampPanel: payload.timestampPanel ?? null,
    ipOrigen: payload.ipOrigen ?? null,
    frameCrudo: payload.frameCrudo ?? '',
    dataDescifrada: dataDescifrada ?? payload.dataDescifrada ?? null,
    idDispositivo: payload.idDispositivo ?? null,
    idCliente: payload.idCliente ?? null,
    idempotencyKey: envelope.eventId.toLowerCase(),
  };
}

export function mapAxproHeartbeatToIngestDto(
  envelope: AxproTelemetryEnvelope<AxproHeartbeatPayload>,
): IngestHeartbeatDto {
  const payload = envelope.payload;
  const ultimoHeartbeat =
    payload.ultimoHeartbeat?.trim() || envelope.receivedAt;

  return {
    cuentaSia: envelope.deviceId,
    idDispositivo: payload.idDispositivo ?? null,
    idCliente: payload.idCliente ?? null,
    ultimoHeartbeat,
    seq: String(payload.seq ?? '0000'),
    ipOrigen: payload.ipOrigen ?? null,
    idempotencyKey: envelope.eventId.toLowerCase(),
  };
}

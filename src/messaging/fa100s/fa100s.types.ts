/**
 * Contrato AMQP de springFA100S (relojes). Mismo envelope que jt808/jimi;
 * docs: springTrackCam docs/cambios-back-next.md §10.
 * - position: Lat/Lng reales o la última posición válida (`positionValid=false`).
 * - alarm: puede venir sin coordenadas (`Lat/Lng = null`) si nunca hubo GPS.
 * - alarm_location: ubicación que llegó después para una alarma sin GPS;
 *   corrige la alarma original (`alarmEventId`), no es una alarma nueva.
 */
export type Fa100sKind = 'position' | 'alarm' | 'alarm_location';

export interface Fa100sPayload {
  Imei: string | number | null;
  Lat: number | null;
  Lng: number | null;
  Estado: number | null;
  FechaHora: string;
  Velocidad: number | null;
  Direccion?: number | null;
  Ignicion?: number | null;
  Alarma1: number | null;
  IdEvento: number;
  Bateria: number | null;
  GPS?: number | null;
  GSM?: number | null;
  Movimiento?: number | null;
  positionValid?: boolean;
  /** Solo alarm_location: eventId de la alarma original. */
  alarmEventId?: string;
  fa100s?: Record<string, unknown>;
}

export interface Fa100sTelemetryEnvelope {
  eventId: string;
  protocol: 'fa100s';
  kind: Fa100sKind;
  /** IMEI de 15 dígitos (Dispositivos.Imei). */
  deviceId: string;
  receivedAt: string;
  payload: Fa100sPayload;
}

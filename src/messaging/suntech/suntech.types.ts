/**
 * Contrato AMQP de springSuntech (rastreadores Suntech: protocolo universal y ST300). Mismo envelope
 * que jt808/jimi/fa100s; docs: springSuntech/docs/protocolo-universal.md.
 * - position: solo con fix GPS (Lat/Lng medidas).
 * - alarm: pánico, robo, desplazamiento ilegal, energía, colisión, antena
 *   GNSS, batería y exceso de velocidad; sin GPS llega con Lat/Lng = null.
 * - deviceId = DEV_ID sin ceros a la izquierda (9 o 10 dígitos), como lo dio de alta el legacy (Dispositivos.Imei de los AVL).
 */
export type SuntechKind = 'position' | 'alarm';

export interface SuntechPayload {
  Imei: string | number | null;
  Lat: number | null;
  Lng: number | null;
  Estado: number | null;
  FechaHora: string;
  Velocidad: number | null;
  Direccion?: number | null;
  Odometro?: number | null;
  Ignicion?: number | null;
  Alarma1: number | null;
  IdEvento: number;
  Alimentacion?: number | null;
  GPS?: number | null;
  Movimiento?: number | null;
  positionValid?: boolean;
  FuentePosicion?: number | null;
  RadioM?: number | null;
  suntech?: Record<string, unknown>;
}

export interface SuntechTelemetryEnvelope {
  eventId: string;
  protocol: 'suntech';
  kind: SuntechKind;
  deviceId: string;
  receivedAt: string;
  payload: SuntechPayload;
}

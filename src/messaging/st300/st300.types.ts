/**
 * Contrato AMQP de springST300 (rastreadores Suntech ST300). Mismo envelope
 * que jt808/jimi/fa100s; docs: springST300/docs/protocolo-st300.md.
 * - position: solo con fix GPS (Lat/Lng medidas).
 * - alarm: pánico, robo, desplazamiento ilegal, energía, colisión, antena
 *   GNSS, batería y exceso de velocidad; sin GPS llega con Lat/Lng = null.
 * - deviceId = DEV_ID de 9 dígitos del ST300 (Dispositivos.Imei de los AVL).
 */
export type St300Kind = 'position' | 'alarm';

export interface St300Payload {
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
  st300?: Record<string, unknown>;
}

export interface St300TelemetryEnvelope {
  eventId: string;
  protocol: 'st300';
  kind: St300Kind;
  deviceId: string;
  receivedAt: string;
  payload: St300Payload;
}

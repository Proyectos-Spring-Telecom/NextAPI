export type JimiKind = 'position' | 'alarm';

export interface JimiExtension {
  protocol?: number;
  source?: 'a4' | 'acc' | 'heartbeat' | string;
  code?: string;
  label?: string;
}

/** Shape Acometidas + Combustible (litros UL212). Imei siempre null en AMQP. */
export interface JimiAcometidasPayload {
  Imei: null;
  Lat: number;
  Lng: number;
  Estado: number | null;
  FechaHora: string;
  Velocidad: number;
  Direccion: number;
  Odometro: number | null;
  Ignicion: number | null;
  Alarma1: number | null;
  Alarma2: number | null;
  Energia: number | null;
  IdEvento: number;
  IdFoto: number | null;
  Bateria: number | null;
  Alimentacion: number | null;
  GPS: number | null;
  GSM: number | null;
  Movimiento: number | null;
  /** Litros (float). Columna Posiciones.Combustible es int → se redondea al persistir. */
  Combustible: number | null;
  Foto1: string | null;
  Foto2: string | null;
  Foto3: string | null;
  Video1: string | null;
  Video2: string | null;
  Video3: string | null;
  jimi?: JimiExtension;
}

export interface JimiTelemetryEnvelope {
  eventId: string;
  protocol: 'jimi';
  kind: JimiKind;
  deviceId: string;
  receivedAt: string;
  payload: JimiAcometidasPayload;
}

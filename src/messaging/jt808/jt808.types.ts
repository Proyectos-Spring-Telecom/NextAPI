export type Jt808Kind = 'position' | 'alarm' | 'photo';

export interface Jt808AlarmExtension {
  source: string;
  code: string;
  label: string;
}

export interface Jt808PhotoExtension {
  multimediaId?: number;
  channelId?: number;
  filePath?: string;
  fileBytes?: number;
  jpegMagic?: boolean;
  locationSource?: string;
  locationId?: number | null;
}

/** Tabla 4 Acometidas — columnas Posiciones / UltimaPosicion */
export interface AcometidasPayload {
  Imei: number | null;
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
  Combustible: number | null;
  Foto1: string | null;
  Foto2: string | null;
  Foto3: string | null;
  Video1: string | null;
  Video2: string | null;
  Video3: string | null;
  jt808?: Jt808AlarmExtension | Jt808PhotoExtension;
}

export interface Jt808TelemetryEnvelope {
  eventId: string;
  protocol: 'jt808';
  kind: Jt808Kind;
  deviceId: string;
  receivedAt: string;
  payload: AcometidasPayload;
}

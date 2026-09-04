export type Jt808Kind = 'position' | 'alarm' | 'photo';

export interface Jt808AlarmExtension {
  source: string;
  code: string;
  label: string;
}

export interface Jt808PhotoExtension {
  multimediaId?: number;
  channelId?: number;
  channelIds?: number[];
  mediaType?: 'photo' | 'photo_batch' | 'video';
  trigger?: string;
  filePath?: string;
  filePaths?: string[];
  fileBytes?: number;
  jpegMagic?: boolean;
  locationSource?: string;
  locationId?: number | null;
}

/** Tabla 4 Acometidas — payload AMQP (URLs en Foto1..3 / Video1..3; IDs al persistir) */
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
  /** ID multimedia JT808 (opcional); no es Fotos.Id */
  IdFoto: number | null;
  Bateria: number | null;
  Alimentacion: number | null;
  GPS: number | null;
  GSM: number | null;
  Movimiento: number | null;
  Combustible: number | null;
  /** URLs públicas → INSERT Fotos → IdFoto1..3 */
  Foto1: string | null;
  Foto2: string | null;
  Foto3: string | null;
  /** URLs públicas → INSERT Videos → IdVideo1..3 */
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

import { Posiciones } from 'src/entities/Posiciones';

/**
 * Contrato común de ingest a Posiciones para cualquier gateway GPS/dashcam.
 * Cada protocolo mapea su envelope → este request y llama a PosicionIngestService.
 */
export type PosicionIngestKind = 'position' | 'alarm' | 'photo' | string;

/** URLs públicas de media (opcionales). Paths absolutos del gateway se ignoran. */
export interface PosicionIngestMedia {
  Foto1?: string | null;
  Foto2?: string | null;
  Foto3?: string | null;
  Video1?: string | null;
  Video2?: string | null;
  Video3?: string | null;
  /** ID multimedia del protocolo (p. ej. JT808) → Fotos.IdFoto, no FK de Posiciones */
  multimediaId?: number | null;
}

export interface PosicionIngestBase {
  /** Idempotencia global (ideal: SHA-256 hex 64). Prefijar por protocolo si hace falta. */
  eventId: string;
  /** jt808 | teltonika | ... */
  protocol: string;
  kind: PosicionIngestKind;
  /** Identificador del dispositivo en el gateway (NumeroSerie, etc.) */
  deviceId: string;
  routingKey: string;
  /** IMEI ya resuelto (Dispositivos.Imei) */
  imei: string;
  /** CatTipoDispositivo.Id (RASTREADOR/AVL/TELEFONO/TRACKCAM, …) */
  idTipoDispositivo?: number | null;
  /** Instalación activa del dispositivo (geocerca requiere IdInstalacion no null). */
  idInstalacion?: number | null;
  /** JSON de auditoría → TelemetryIngestLog.PayloadJson */
  auditPayload?: unknown;
}

export interface PosicionIngestAlarmRequest extends PosicionIngestBase {
  kind: 'alarm' | string;
}

export interface PosicionIngestPositionRequest extends PosicionIngestBase {
  kind: 'position' | 'photo' | string;
  /** Fila lista para INSERT (Estado/Ignicion del gateway; no forzar NULL). */
  posicion: Partial<Posiciones>;
  media?: PosicionIngestMedia;
}

export type PosicionIngestResult = {
  posicionId?: number;
  duplicate?: boolean;
  audited?: boolean;
};

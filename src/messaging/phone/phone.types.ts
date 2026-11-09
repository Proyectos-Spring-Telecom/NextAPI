/**
 * Contrato AMQP de springTrackPhone (app de rastreo en teléfonos Android,
 * varios clientes). Mismo envelope que jt808/jimi/fa100s; docs del socket:
 * springTrackPhone/README.md y docs/contrato-app.md.
 * - Solo `position`, siempre con Lat/Lng medidas en ese reporte: el socket no
 *   publica nada si el teléfono no midió (regla 9 de springSocketKit).
 * - `FuentePosicion`: 0 GPS, 1 WiFi, 2 antena (springGeoloc), 4 teléfono
 *   (ubicación fusionada o por red de Android). `RadioM`: siempre, en metros.
 */
export type PhoneKind = 'position';

export interface PhonePayload {
  Imei: string | number | null;
  Lat: number;
  Lng: number;
  Estado: number | null;
  FechaHora: string;
  Velocidad: number | null;
  Direccion?: number | null;
  IdEvento: number;
  Bateria: number | null;
  Alimentacion?: number | null;
  GSM?: number | null;
  Movimiento?: number | null;
  positionValid?: boolean;
  FuentePosicion: number;
  RadioM: number | null;
  /** reporteId, origen, proveedor, precisionM, medidaEn, diferida, wifi, celdas, idCliente, app. */
  phone?: Record<string, unknown>;
}

export interface PhoneTelemetryEnvelope {
  eventId: string;
  protocol: 'phone';
  kind: PhoneKind;
  /** IMEI de 15 dígitos (Dispositivos.Imei): el real al migrar de la app 2.x, o sintético `99…`. */
  deviceId: string;
  receivedAt: string;
  payload: PhonePayload;
}

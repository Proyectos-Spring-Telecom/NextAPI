/** Campos de RelojConfig que se capturan desde Next (sin IdDispositivo/IdCliente). */
export const RELOJ_CONFIG_KEYS = [
  'intervaloReporteSegundos',
  'intervaloGpsSegundos',
  'deteccionCaida',
  'llamadaPorCaida',
  'sensibilidadCaida',
] as const;

export type RelojConfigKey = (typeof RELOJ_CONFIG_KEYS)[number];

/** El reloj se identifica con un ID de fabricante de 10 dígitos (trama `[3G*ID*…]`). */
export const RELOJ_NUMERO_SERIE_RE = /^\d{10}$/;
/** La telemetría se busca por IMEI (15 dígitos, trama ICCID). */
export const RELOJ_IMEI_RE = /^\d{15}$/;

/** Campos de RelojConfig que se capturan desde Next (sin IdDispositivo/IdCliente). */
export const RELOJ_CONFIG_KEYS = [
  'intervaloReporteSegundos',
  'intervaloGpsSegundos',
  'deteccionCaida',
  'llamadaPorCaida',
  'sensibilidadCaida',
] as const;

export type RelojConfigKey = (typeof RELOJ_CONFIG_KEYS)[number];

/**
 * Número de serie: el ID de 10 dígitos del reloj (trama `[3G*ID*…]`) o su IMEI.
 * Solo identifica; la telemetría se asocia por IMEI. El primer reloj (28/10/2026)
 * se dio de alta con el IMEI como número de serie.
 */
export const RELOJ_NUMERO_SERIE_RE = /^(\d{10}|\d{15})$/;
/** La telemetría se busca por IMEI (15 dígitos, trama ICCID). */
export const RELOJ_IMEI_RE = /^\d{15}$/;

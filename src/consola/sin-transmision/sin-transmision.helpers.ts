/**
 * Helpers puros de Consola → Sin Transmisión (sin Nest / TypeORM, testeables).
 * Todas las fechas son hora de pared `YYYY-MM-DD HH:mm:ss`, igual que
 * `UltimaPosicion.FechaHora`.
 */

/** Límite de días que se puede pedir (1 año). */
export const SIN_TRANSMISION_MAX_DIAS = 365;

const pad = (n: number) => String(n).padStart(2, '0');

/** `Date` → hora de pared local del proceso (TZ = America/Mexico_City). */
export function fechaParedDesdeDate(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Milisegundos de una hora de pared (`YYYY-MM-DD[ T]HH:mm:ss`), tratada como UTC. */
function msPared(fecha: string): number {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/** Minutos entre dos horas de pared (null si alguna es inválida). */
export function minutosEntreFechasPared(desde: string, hasta: string): number | null {
  const ms = msPared(hasta) - msPared(desde);
  return Number.isFinite(ms) ? Math.floor(ms / 60_000) : null;
}

/** Hora de pared menos `dias` días. */
export function restarDiasPared(fecha: string, dias: number): string {
  const ms = msPared(fecha) - dias * 86_400_000;
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * ¿La unidad cuenta como "sin transmitir" en el corte?
 * - Nunca ha transmitido (`ultima` null) → sí.
 * - Su última transmisión es anterior al corte (ahora − días) → sí.
 * Devuelve también los minutos sin transmitir (null si nunca transmitió).
 */
export function evaluarSinTransmision(
  ultima: string | null,
  ahora: string,
  dias: number,
): { incluir: boolean; minutosSinTransmitir: number | null } {
  if (!ultima) return { incluir: true, minutosSinTransmitir: null };
  const corte = restarDiasPared(ahora, dias);
  const minutos = minutosEntreFechasPared(ultima, ahora);
  return {
    incluir: ultima.replace('T', ' ') < corte,
    minutosSinTransmitir: minutos != null && minutos >= 0 ? minutos : 0,
  };
}

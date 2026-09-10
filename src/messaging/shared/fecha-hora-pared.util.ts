/**
 * Hora de pared (México / contrato Acometidas) ↔ Date para MySQL DATETIME
 * con `DB_TZ` UTC (`Z` / `-00:00` / `+00:00`).
 *
 * TypeORM + mysql2: si pasas `new Date("YYYY-MM-DD HH:mm:ss")` con
 * `TZ=America/Mexico_City`, el string se interpreta en local y al escribir
 * en UTC guarda +6 h. Hay que armar el Date con `Date.UTC(...)` para que
 * los componentes UTC = dígitos de pared (mismo criterio que
 * `formatFechaPosicion` al leer con `getUTC*`).
 */
const FECHA_HORA_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?/;

export function parseFechaHoraPared(raw: string): Date {
  const m = String(raw ?? '').trim().match(FECHA_HORA_RE);
  if (!m) {
    throw new Error(`FechaHora inválida (se espera YYYY-MM-DD HH:mm:ss): ${raw}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (
    !Number.isFinite(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d ||
    dt.getUTCHours() !== h ||
    dt.getUTCMinutes() !== mi ||
    dt.getUTCSeconds() !== s
  ) {
    throw new Error(`FechaHora inválida: ${raw}`);
  }
  return dt;
}

import { createHmac, randomBytes } from 'crypto';
import { isIP } from 'net';

/** Eventos que un cliente puede suscribir. */
export const EVENTOS_WEBHOOK = [
  'alerta.abierta',
  'geocerca.entrada',
  'geocerca.salida',
  'jornada.cerrada',
  'prueba',
] as const;
export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];

/** Reintentos antes de darlo por fallido (~1 día con el retraso creciente). */
export const MAX_INTENTOS_WEBHOOK = 10;

export function generarSecreto(): string {
  return randomBytes(32).toString('hex');
}

/** Firma: HMAC-SHA256 hex de `<timestamp>.<cuerpo>` con el secreto de la suscripción. */
export function firmar(secreto: string, timestamp: string, cuerpo: string): string {
  return createHmac('sha256', secreto).update(`${timestamp}.${cuerpo}`).digest('hex');
}

/** Minutos de espera antes del intento `n` (1, 2, 4, 8… hasta 6 h). */
export function esperaMinutos(intentos: number): number {
  return Math.min(360, 2 ** Math.max(0, intentos - 1));
}

/**
 * La IP es pública (no loopback, privada, enlace local, CGNAT, multicast ni
 * reservada): el servidor nunca debe llamar a su propia red.
 */
export function esIpPublica(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return false;
    if (
      s.startsWith('fe80') ||
      s.startsWith('fc') ||
      s.startsWith('fd') ||
      s.startsWith('ff')
    )
      return false;
    const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    return mapeada ? esIpPublica(mapeada[1]) : true;
  }
  return false;
}

/** Error si la URL no es https o apunta a un host claramente interno. */
export function validarUrlWebhook(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'La URL no es válida';
  }
  if (u.protocol !== 'https:') return 'La URL debe ser https';
  if (u.username || u.password) return 'La URL no puede llevar usuario ni contraseña';
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'La URL debe apuntar a un servidor público';
  }
  if (isIP(host) && !esIpPublica(host))
    return 'La URL debe apuntar a un servidor público';
  return null;
}

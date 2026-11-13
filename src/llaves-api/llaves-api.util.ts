import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Formato: `nxt_<prefijo 8 hex>_<secreto 43 base64url>`. */
const FORMATO_LLAVE = /^nxt_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;

export function generarLlave(): { llave: string; prefijo: string; hash: string } {
  const prefijo = randomBytes(4).toString('hex');
  const llave = `nxt_${prefijo}_${randomBytes(32).toString('base64url')}`;
  return { llave, prefijo, hash: hashLlave(llave) };
}

export function hashLlave(llave: string): string {
  return createHash('sha256').update(llave).digest('hex');
}

/** Prefijo de una llave con formato válido; null si no lo tiene. */
export function prefijoDe(llave: string): string | null {
  return FORMATO_LLAVE.exec(llave.trim())?.[1] ?? null;
}

/** Compara en tiempo constante el hash de la llave con el guardado. */
export function llaveCoincide(llave: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashLlave(llave.trim()), 'hex');
  const b = Buffer.from(hashGuardado, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

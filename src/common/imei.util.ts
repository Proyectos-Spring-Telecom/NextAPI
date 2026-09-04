/**
 * IMEI / ICCID como string para no perder precisión (JSON Number / JS Number
 * redondean enteros > Number.MAX_SAFE_INTEGER). La columna BD sigue siendo bigint.
 */
export function imeiToString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') {
    const s = value.toString();
    return s === '' ? null : s;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // Ya pudo venir redondeado del driver; no hay forma de recuperar dígitos.
    return String(Math.trunc(value));
  }
  const s = String(value).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  return s;
}

export function assertImeiString(value: unknown): string {
  const s = imeiToString(value);
  if (!s) {
    throw new Error('IMEI inválido');
  }
  return s;
}

import { createDecipheriv } from 'crypto';

/**
 * Descifra payload SIA DC-09 AES (AX PRO).
 * Formato esperado: hex con IV (16 bytes) + ciphertext (AES-CBC).
 * La clave puede venir en hex o texto plano según configuración del panel.
 */
export function decryptSiaAes(
  cipherTextHex: string,
  keyMaterial: string,
  aesBits: 128 | 256 = 128,
): string {
  const normalized = cipherTextHex.replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length < 32) {
    throw new Error('Ciphertext SIA inválido');
  }

  const key = resolveAesKey(keyMaterial, aesBits);
  const data = Buffer.from(normalized, 'hex');
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);
  if (encrypted.length === 0) {
    throw new Error('Ciphertext SIA vacío');
  }

  const decipher = createDecipheriv(`aes-${aesBits}-cbc`, key, iv);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8').replace(/\0+$/, '').trim();
}

function resolveAesKey(keyMaterial: string, aesBits: 128 | 256): Buffer {
  const trimmed = keyMaterial.trim();
  const byteLen = aesBits / 8;
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= byteLen * 2) {
    return Buffer.from(trimmed, 'hex').subarray(0, byteLen);
  }
  return Buffer.from(trimmed, 'utf8').subarray(0, byteLen);
}

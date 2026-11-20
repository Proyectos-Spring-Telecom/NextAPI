/**
 * Reglas puras del correo libre y del aviso masivo (docs/front-next.md §35).
 */
import { BadRequestException } from '@nestjs/common';

export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
export const ASUNTO_DEFECTO = 'Aviso de Spring Telecom';
const MENSAJE_DEFECTO = 'Buen día.\n\nQuedamos a sus órdenes.\nSpring Telecom';
const MENSAJE_DEFECTO_ADJUNTO = 'Buen día.\n\nLe compartimos el archivo adjunto.\n\nQuedamos a sus órdenes.\nSpring Telecom';

/** Extensión → tipos MIME aceptados (el navegador a veces manda `application/octet-stream`). */
const TIPOS: Record<string, { mime: string[]; tipo: string }> = {
  pdf: { mime: ['application/pdf'], tipo: 'application/pdf' },
  jpg: { mime: ['image/jpeg'], tipo: 'image/jpeg' },
  jpeg: { mime: ['image/jpeg'], tipo: 'image/jpeg' },
  png: { mime: ['image/png'], tipo: 'image/png' },
  webp: { mime: ['image/webp'], tipo: 'image/webp' },
  doc: { mime: ['application/msword'], tipo: 'application/msword' },
  docx: {
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xls: { mime: ['application/vnd.ms-excel'], tipo: 'application/vnd.ms-excel' },
  xlsx: {
    mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  csv: { mime: ['text/csv', 'application/vnd.ms-excel', 'text/plain'], tipo: 'text/csv' },
};
const GENERICOS = new Set(['application/octet-stream', '']);

export interface AdjuntoValido {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** El adjunto (opcional) pesa 10 MB o menos y es de un tipo permitido; si no, 400. */
export function validarAdjunto(file: Express.Multer.File | undefined): AdjuntoValido | null {
  if (!file) return null;
  if (!file.buffer?.length) throw new BadRequestException('El archivo está vacío');
  if (file.size > MAX_ADJUNTO_BYTES) throw new BadRequestException('El archivo pesa más de 10 MB');
  const nombre = nombreOriginal(file.originalname);
  const ext = nombre.includes('.') ? nombre.split('.').pop()!.toLowerCase() : '';
  const t = TIPOS[ext];
  const mime = String(file.mimetype ?? '').toLowerCase();
  if (!t || !(t.mime.includes(mime) || GENERICOS.has(mime))) {
    throw new BadRequestException('Tipo de archivo no permitido: solo PDF, JPG, PNG, WEBP, Word, Excel o CSV');
  }
  return { filename: nombre, content: file.buffer, contentType: t.tipo };
}

/** Multer entrega el nombre en latin1; se recupera el UTF-8 (acentos, ñ) y se quita la ruta. */
export function nombreOriginal(original: string | undefined): string {
  let n = String(original ?? 'archivo');
  try {
    const utf8 = Buffer.from(n, 'latin1').toString('utf8');
    if (!utf8.includes('�')) n = utf8;
  } catch {
    /* se queda el original */
  }
  n = n.split(/[\\/]/).pop()!.replace(/[\r\n"]/g, '').trim();
  return n.slice(-255) || 'archivo';
}

export function asuntoFinal(asunto: string | undefined): string {
  return asunto?.trim() || ASUNTO_DEFECTO;
}

export function mensajeFinal(mensaje: string | undefined, conAdjunto: boolean): string {
  return mensaje?.trim() || (conAdjunto ? MENSAJE_DEFECTO_ADJUNTO : MENSAJE_DEFECTO);
}

/** `"12,45, 78"` → `[12, 45, 78]` sin repetidos; 400 si no hay ninguno. */
export function idsDeTexto(texto: string | undefined): number[] {
  const ids = [
    ...new Set(
      String(texto ?? '')
        .split(/[,;\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (!ids.length) throw new BadRequestException('Elige al menos un usuario');
  return ids;
}

export function enLotes<T>(items: T[], tam: number): T[][] {
  const n = Math.max(1, Math.floor(tam));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

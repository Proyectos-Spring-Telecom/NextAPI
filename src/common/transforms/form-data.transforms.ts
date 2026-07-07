import { TransformFnParams } from 'class-transformer';

function parseNumberListString(raw: string): number[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(Number);
      }
    } catch {
      return undefined;
    }
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map(Number);
  }

  const single = Number(trimmed);
  if (!Number.isNaN(single)) {
    return [single];
  }

  return undefined;
}

/**
 * Convierte arreglos enviados en multipart/form-data a number[] (creación).
 * Acepta: JSON "[1,2,3]", coma-separado "1,2,3" o valor único "2".
 * Devuelve undefined si el campo no se envió.
 */
export function transformNumberArray({
  value,
}: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value === 'number') {
    return [value];
  }

  if (typeof value === 'string') {
    const parsed = parseNumberListString(value);
    return parsed ?? value;
  }

  return value;
}

/**
 * Arreglos opcionales en actualización: '' = omitido, '[]' = vacío intencional.
 */
export function transformOptionalNumberArray({
  value,
}: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (trimmedValue === '') {
      return undefined;
    }

    if (trimmedValue.startsWith('[')) {
      try {
        const parsedValue: unknown = JSON.parse(trimmedValue);
        if (Array.isArray(parsedValue)) {
          return parsedValue.map(Number);
        }
        return value;
      } catch {
        return value;
      }
    }

    const parsed = parseNumberListString(trimmedValue);
    return parsed ?? value;
  }

  if (typeof value === 'number') {
    return [value];
  }

  return value;
}

/** Número opcional en actualización: '' no debe convertirse en 0. */
export function transformOptionalNumber({
  value,
}: TransformFnParams): number | undefined | unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isNaN(parsedValue) ? value : parsedValue;
}

/** Texto opcional en actualización: '' = campo omitido (no sobrescribir). */
export function transformOptionalString({
  value,
}: TransformFnParams): string | undefined | unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

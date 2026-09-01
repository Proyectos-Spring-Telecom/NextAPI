import { BadRequestException } from '@nestjs/common';
import {
  isPermanentDbError,
  isTransientDbError,
} from './db-errors.util';

export function isPermanentIngestError(error: unknown): boolean {
  if (error instanceof BadRequestException) {
    return true;
  }
  if (isPermanentDbError(error)) {
    return true;
  }
  if (error instanceof SyntaxError) {
    return true;
  }
  if (error instanceof Error && /incoherente|inválido/i.test(error.message)) {
    return true;
  }
  return false;
}

export function isRetryableIngestError(error: unknown): boolean {
  if (isPermanentIngestError(error)) {
    return false;
  }
  if (isTransientDbError(error)) {
    return true;
  }
  // Desconocido: no reintentar en bucle — tratar como permanente vía handler
  return false;
}

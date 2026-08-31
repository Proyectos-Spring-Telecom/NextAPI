import { BadRequestException } from '@nestjs/common';

export function isPermanentIngestError(error: unknown): boolean {
  if (error instanceof BadRequestException) {
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

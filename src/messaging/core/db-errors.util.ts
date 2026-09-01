import { QueryFailedError } from 'typeorm';

export function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driver = error.driverError as { code?: string; errno?: number };
  return driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062;
}

/** Errores que no deben reintentarse (ACK/DLQ directo). */
export function isPermanentDbError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driver = error.driverError as { code?: string; errno?: number };
  const permanentCodes = new Set([
    'ER_NO_SUCH_TABLE',
    'ER_BAD_FIELD_ERROR',
    'ER_PARSE_ERROR',
    'ER_TRUNCATED_WRONG_VALUE',
  ]);
  return (
    permanentCodes.has(driver?.code ?? '') ||
    driver?.errno === 1146 // ER_NO_SUCH_TABLE
  );
}

/** Errores transitorios que pueden reintentarse (hasta max retries). */
export function isTransientDbError(error: unknown): boolean {
  if (error instanceof QueryFailedError) {
    const driver = error.driverError as { code?: string };
    return (
      driver?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
      driver?.code === 'ER_LOCK_DEADLOCK' ||
      driver?.code === 'PROTOCOL_CONNECTION_LOST' ||
      driver?.code === 'ECONNRESET'
    );
  }
  const message = (error as Error)?.message ?? '';
  return /ECONNREFUSED|ETIMEDOUT|Connection lost|read ECONNRESET/i.test(
    message,
  );
}

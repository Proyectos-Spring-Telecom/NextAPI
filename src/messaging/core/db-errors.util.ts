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

/**
 * MySQL caído, reiniciando o sin conexiones libres. No es culpa del mensaje:
 * el consumidor espera a que la base vuelva sin gastar reintentos.
 */
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'ER_SERVER_SHUTDOWN', // 1053 "Server shutdown in progress"
  'ER_CON_COUNT_ERROR', // 1040 "Too many connections"
]);
const DB_UNAVAILABLE_ERRNOS = new Set([1040, 1053, 2006, 2013]);

export function isDbUnavailableError(error: unknown): boolean {
  const own = error as { code?: string; errno?: number };
  const driver =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string; errno?: number })
      : undefined;
  for (const e of [own, driver]) {
    if (!e) continue;
    if (DB_UNAVAILABLE_CODES.has(e.code ?? '')) return true;
    if (DB_UNAVAILABLE_ERRNOS.has(Number(e.errno))) return true;
  }
  const message = (error as Error)?.message ?? '';
  return /ECONNREFUSED|ETIMEDOUT|Connection lost|read ECONNRESET|Server shutdown in progress|Too many connections|Pool is closed|server has gone away|connection is in closed state/i.test(
    message,
  );
}

/** Errores transitorios que pueden reintentarse (hasta max retries). */
export function isTransientDbError(error: unknown): boolean {
  if (isDbUnavailableError(error)) {
    return true;
  }
  if (error instanceof QueryFailedError) {
    const driver = error.driverError as { code?: string };
    return (
      driver?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
      driver?.code === 'ER_LOCK_DEADLOCK'
    );
  }
  return false;
}

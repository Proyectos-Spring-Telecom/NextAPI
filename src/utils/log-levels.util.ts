import type { LogLevel } from '@nestjs/common';

const ORDER: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/**
 * Niveles de log según `LOG_LEVEL` (fatal|error|warn|log|debug|verbose; default `log`).
 * Lo que se repite por mensaje de la cola (ingesta, caché, JWT) va en `debug`:
 * con miles de equipos llenaría el disco; el detalle ya queda en MySQL.
 */
export function logLevels(level?: string): LogLevel[] {
  const wanted = (level ?? '').trim().toLowerCase() as LogLevel;
  const upTo = ORDER.includes(wanted) ? wanted : 'log';
  return ORDER.slice(0, ORDER.indexOf(upTo) + 1);
}

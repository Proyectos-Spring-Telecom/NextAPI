import { QueryFailedError } from 'typeorm';
import { isDbUnavailableError, isTransientDbError } from './db-errors.util';
import { isRetryableIngestError } from './ingest-errors.util';

const queryError = (code: string, errno: number, message: string) =>
  new QueryFailedError('INSERT ...', [], Object.assign(new Error(message), { code, errno }));

describe('db-errors.util', () => {
  it('MySQL reiniciando (21-oct) cuenta como no disponible y reintentable', () => {
    const shutdown = queryError('ER_SERVER_SHUTDOWN', 1053, 'Server shutdown in progress');
    expect(isDbUnavailableError(shutdown)).toBe(true);
    expect(isRetryableIngestError(shutdown)).toBe(true);

    const refused = Object.assign(new Error('connect ECONNREFUSED 216.238.90.14:3306'), {
      code: 'ECONNREFUSED',
    });
    expect(isDbUnavailableError(refused)).toBe(true);
  });

  it.each([
    ['Too many connections', queryError('ER_CON_COUNT_ERROR', 1040, 'Too many connections')],
    ['Pool is closed', new Error('Pool is closed.')],
    ['conexión perdida', Object.assign(new Error('Connection lost: The server closed the connection.'), { code: 'PROTOCOL_CONNECTION_LOST' })],
    ['server has gone away', queryError('CR_SERVER_GONE_ERROR', 2006, 'MySQL server has gone away')],
  ])('%s → no disponible', (_name, error) => {
    expect(isDbUnavailableError(error)).toBe(true);
  });

  it('deadlock es transitorio pero no es "base caída"', () => {
    const deadlock = queryError('ER_LOCK_DEADLOCK', 1213, 'Deadlock found');
    expect(isDbUnavailableError(deadlock)).toBe(false);
    expect(isTransientDbError(deadlock)).toBe(true);
  });

  it('errores del mensaje no se confunden con base caída', () => {
    expect(isDbUnavailableError(queryError('ER_BAD_FIELD_ERROR', 1054, "Unknown column 'Foto1'"))).toBe(false);
    expect(isDbUnavailableError(new Error('kind=x incoherente con cola avl'))).toBe(false);
  });
});

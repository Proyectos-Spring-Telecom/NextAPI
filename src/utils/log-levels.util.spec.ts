import { logLevels } from './log-levels.util';

describe('logLevels', () => {
  it('por defecto hasta log (sin debug)', () => {
    expect(logLevels()).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(logLevels('otro')).toEqual(['fatal', 'error', 'warn', 'log']);
  });

  it('respeta LOG_LEVEL', () => {
    expect(logLevels('DEBUG')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
    expect(logLevels('warn')).toEqual(['fatal', 'error', 'warn']);
  });
});

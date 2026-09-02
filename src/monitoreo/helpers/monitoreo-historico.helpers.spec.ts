import { parseFechaHistorico } from './monitoreo-historico.helpers';

describe('monitoreo-historico.helpers', () => {
  it('parseFechaHistorico conserva hora de pared sin desfase UTC', () => {
    expect(parseFechaHistorico('2026-08-31 17:00:00')).toBe(
      '2026-08-31 17:00:00',
    );
    expect(parseFechaHistorico('2026-08-31T19:54:00')).toBe(
      '2026-08-31 19:54:00',
    );
    expect(parseFechaHistorico('2026-08-31 19:54')).toBe(
      '2026-08-31 19:54:00',
    );
  });
});

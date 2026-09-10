import { parseFechaHoraPared } from './fecha-hora-pared.util';

describe('parseFechaHoraPared', () => {
  it('arma Date con componentes UTC = dígitos de pared (evita +6h con DB_TZ UTC)', () => {
    const dt = parseFechaHoraPared('2026-09-10 11:47:10');
    expect(dt.getUTCFullYear()).toBe(2026);
    expect(dt.getUTCMonth()).toBe(8);
    expect(dt.getUTCDate()).toBe(10);
    expect(dt.getUTCHours()).toBe(11);
    expect(dt.getUTCMinutes()).toBe(47);
    expect(dt.getUTCSeconds()).toBe(10);
  });

  it('acepta separador T', () => {
    const dt = parseFechaHoraPared('2026-09-10T11:47:10');
    expect(dt.getUTCHours()).toBe(11);
  });

  it('rechaza formato inválido', () => {
    expect(() => parseFechaHoraPared('10/09/2026')).toThrow(/FechaHora inválida/);
  });
});

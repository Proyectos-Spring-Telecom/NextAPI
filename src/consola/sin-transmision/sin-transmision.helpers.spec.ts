import {
  evaluarSinTransmision,
  fechaParedDesdeDate,
  minutosEntreFechasPared,
  restarDiasPared,
} from './sin-transmision.helpers';

describe('sin-transmision.helpers', () => {
  it('fechaParedDesdeDate usa la hora local del proceso', () => {
    expect(fechaParedDesdeDate(new Date(2026, 9, 26, 8, 5, 9))).toBe('2026-10-26 08:05:09');
  });

  it('restarDiasPared cruza meses sin desfase de zona', () => {
    expect(restarDiasPared('2026-11-02 10:00:00', 3)).toBe('2026-10-30 10:00:00');
  });

  it('minutosEntreFechasPared acepta T o espacio', () => {
    expect(minutosEntreFechasPared('2026-10-26T10:00:00', '2026-10-26 12:30:00')).toBe(150);
  });

  describe('evaluarSinTransmision', () => {
    const ahora = '2026-10-26 12:00:00';

    it('incluye la unidad que nunca ha transmitido', () => {
      expect(evaluarSinTransmision(null, ahora, 1)).toEqual({
        incluir: true,
        minutosSinTransmitir: null,
      });
    });

    it('incluye si la última transmisión es anterior al corte', () => {
      const r = evaluarSinTransmision('2026-10-24T11:59:59', ahora, 2);
      expect(r.incluir).toBe(true);
      expect(r.minutosSinTransmitir).toBe(2 * 24 * 60);
    });

    it('excluye si transmitió dentro del periodo', () => {
      expect(evaluarSinTransmision('2026-10-25T13:00:00', ahora, 1).incluir).toBe(false);
    });
  });
});

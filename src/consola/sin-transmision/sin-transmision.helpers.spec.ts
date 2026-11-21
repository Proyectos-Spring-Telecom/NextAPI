import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SinTransmisionDto } from './dto/sin-transmision.dto';
import {
  evaluarSinTransmision,
  evaluarSinTransmisionMinutos,
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

  describe('por horas (día en curso)', () => {
    const ahora = '2026-11-20 18:00:00';

    it('incluye la unidad que lleva 3 horas sin transmitir con corte de 2 horas', () => {
      const r = evaluarSinTransmisionMinutos('2026-11-20T15:00:00', ahora, 2 * 60);
      expect(r).toEqual({ incluir: true, minutosSinTransmitir: 180 });
      // Con el corte de 1 día no entraba: ese era el reporte de "solo 7".
      expect(evaluarSinTransmision('2026-11-20T15:00:00', ahora, 1).incluir).toBe(false);
    });

    it('excluye la que transmitió dentro de las últimas 2 horas', () => {
      expect(evaluarSinTransmisionMinutos('2026-11-20T16:30:00', ahora, 120).incluir).toBe(false);
    });
  });

  describe('SinTransmisionDto', () => {
    const errores = (body: object) => validateSync(plainToInstance(SinTransmisionDto, body));

    it('acepta solo dias, solo horas o ambos', () => {
      expect(errores({ dias: 1 })).toHaveLength(0);
      expect(errores({ horas: 2 })).toHaveLength(0);
      expect(errores({ dias: 1, horas: 2 })).toHaveLength(0);
    });

    it('rechaza sin dias ni horas, y horas fuera de rango', () => {
      expect(errores({}).length).toBeGreaterThan(0);
      expect(errores({ horas: 0 }).length).toBeGreaterThan(0);
      expect(errores({ horas: 9000 }).length).toBeGreaterThan(0);
    });
  });
});

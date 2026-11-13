import {
  cuentaParaBase,
  historialCompleto,
  serieAlCierre,
  siguienteDia,
  sumarPorDia,
  type BaseContador,
} from './contadores.helpers';

const captura: BaseContador = {
  valor: 215000,
  fecha: '2026-11-11 08:00:00',
  fuente: 'captura',
};

describe('cuentaParaBase', () => {
  it('cuentan los días posteriores al de la lectura', () => {
    expect(cuentaParaBase(captura, '2026-11-11')).toBe(false);
    expect(cuentaParaBase(captura, '2026-11-12')).toBe(true);
    expect(cuentaParaBase(captura, '2026-11-10')).toBe(false);
  });
  it('sin base cuenta todo', () => {
    expect(
      cuentaParaBase({ valor: 0, fecha: null, fuente: 'sin_base' }, '2026-01-01'),
    ).toBe(true);
  });
});

describe('sumarPorDia', () => {
  it('suma las instalaciones del mismo día (cambio de equipo)', () => {
    const m = sumarPorDia([
      { fecha: '2026-11-12', valor: 10 },
      { fecha: '2026-11-12', valor: 3.5 },
      { fecha: '2026-11-13', valor: 1 },
    ]);
    expect(m.get('2026-11-12')).toBe(13.5);
    expect(m.get('2026-11-13')).toBe(1);
  });
});

describe('serieAlCierre', () => {
  it('acumula desde la base y deja fuera el día de la lectura', () => {
    const porDia = new Map([
      ['2026-11-11', 50],
      ['2026-11-12', 13.23],
      ['2026-11-13', 2],
    ]);
    expect(
      serieAlCierre(captura, 0, ['2026-11-11', '2026-11-12', '2026-11-13'], porDia),
    ).toEqual([
      { fecha: '2026-11-11', valor: 50, alCierre: 215000 },
      { fecha: '2026-11-12', valor: 13.23, alCierre: 215013.23 },
      { fecha: '2026-11-13', valor: 2, alCierre: 215015.23 },
    ]);
  });
  it('suma lo previo al periodo y pone 0 los días sin resumen', () => {
    expect(serieAlCierre(captura, 100, ['2026-11-20'], new Map())).toEqual([
      { fecha: '2026-11-20', valor: 0, alCierre: 215100 },
    ]);
  });
});

describe('historialCompleto', () => {
  it('completo si el resumen empieza a más tardar el día siguiente a la base', () => {
    expect(historialCompleto(captura, '2026-11-12', '2026-11-20')).toBe(true);
    expect(historialCompleto(captura, '2026-11-01', '2026-11-20')).toBe(true);
    expect(historialCompleto(captura, '2026-11-14', '2026-11-20')).toBe(false);
    expect(historialCompleto(captura, null, '2026-11-20')).toBe(false);
  });
  it('una base de ayer o de hoy no necesita resumen guardado', () => {
    expect(historialCompleto(captura, null, '2026-11-12')).toBe(true);
    expect(historialCompleto(captura, null, '2026-11-11')).toBe(true);
  });
  it('sin base nunca es completo', () => {
    expect(
      historialCompleto(
        { valor: 0, fecha: null, fuente: 'sin_base' },
        '2026-01-01',
        '2026-11-20',
      ),
    ).toBe(false);
  });
});

describe('siguienteDia', () => {
  it('cruza fin de mes', () => {
    expect(siguienteDia('2026-10-31')).toBe('2026-11-01');
  });
});

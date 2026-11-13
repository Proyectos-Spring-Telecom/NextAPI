import { bloqueoParo, parseClasesInmovilizador } from './inmovilizador.util';

const base = {
  velocidadMax: 5,
  antiguedadMaxMin: 5,
  ahoraMs: Date.parse('2026-11-13T12:00:00Z'),
};
const hace = (min: number) => base.ahoraMs - min * 60_000;

describe('bloqueoParo', () => {
  it('detenida y con posición reciente: se puede', () => {
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 0, fechaPosicionMs: hace(1) }),
    ).toBeNull();
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 4, fechaPosicionMs: hace(4.9) }),
    ).toBeNull();
  });

  it('en marcha: no', () => {
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 5, fechaPosicionMs: hace(1) }),
    ).toContain('5 km/h');
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 80, fechaPosicionMs: hace(0) }),
    ).toContain('80 km/h');
  });

  it('posición vieja o sin posición: no (no se sabe si va en marcha)', () => {
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 0, fechaPosicionMs: hace(12) }),
    ).toContain('hace 12 min');
    expect(
      bloqueoParo({ ...base, accion: 'paro', velocidad: 0, fechaPosicionMs: null }),
    ).toContain('no tiene posición');
  });

  it('reanudar no tiene restricción', () => {
    expect(
      bloqueoParo({ ...base, accion: 'reanudar', velocidad: 90, fechaPosicionMs: null }),
    ).toBeNull();
  });
});

describe('parseClasesInmovilizador', () => {
  it('clase → protocolo, ignora lo mal escrito', () => {
    const m = parseClasesInmovilizador('gps:jimi, TRACKGAS:Jimi ,malo, :x, CAM:a b');
    expect([...m]).toEqual([
      ['GPS', 'jimi'],
      ['TRACKGAS', 'jimi'],
    ]);
  });
  it('vacío = ninguna clase', () => {
    expect(parseClasesInmovilizador(undefined).size).toBe(0);
    expect(parseClasesInmovilizador('').size).toBe(0);
  });
});

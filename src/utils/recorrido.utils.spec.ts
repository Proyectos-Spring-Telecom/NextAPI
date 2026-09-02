import {
  calcularDistanciaHastaIndex,
  calcularDistanciaKm,
  calcularDistanciaReal,
} from './recorrido.utils';

describe('recorrido.utils', () => {
  const recorrido = [
    { lat: 19.4326, lng: -99.1332 },
    { lat: 19.435, lng: -99.13 },
    { lat: 19.44, lng: -99.125 },
  ];

  it('calcularDistanciaReal retorna 0 con menos de 2 puntos', () => {
    expect(calcularDistanciaReal([])).toBe(0);
    expect(calcularDistanciaReal([recorrido[0]])).toBe(0);
  });

  it('calcularDistanciaReal suma segmentos consecutivos en metros', () => {
    const total = calcularDistanciaReal(recorrido);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(2000);
  });

  it('calcularDistanciaHastaIndex acumula hasta el índice', () => {
    const hasta1 = calcularDistanciaHastaIndex(recorrido, 1);
    const total = calcularDistanciaReal(recorrido);
    expect(hasta1).toBeGreaterThan(0);
    expect(hasta1).toBeLessThan(total);
    expect(calcularDistanciaHastaIndex(recorrido, 2)).toBe(total);
  });

  it('calcularDistanciaKm convierte a km con 2 decimales', () => {
    const km = calcularDistanciaKm(recorrido);
    expect(km).toBe(Math.round((calcularDistanciaReal(recorrido) / 1000) * 100) / 100);
  });
});

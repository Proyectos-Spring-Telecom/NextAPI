import { calcularDistanciaHistoricoMonitoreo } from './monitoreo-distancia.helpers';

describe('monitoreo-distancia.helpers', () => {
  const base = '2026-09-02T10:00:00';

  it('suma todos los tramos consecutivos (sin filtrar saltos ni drift)', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo(
      [
        {
          id: 2,
          lat: 20.5,
          lng: -98,
          fechaHora: `${base.slice(0, 11)}10:01:00`,
        },
        {
          id: 1,
          lat: 19.4326,
          lng: -99.1332,
          fechaHora: base,
        },
      ],
      { yaOrdenadoDesc: true },
    );

    expect(resultado.totalDistanciaKm).toBeGreaterThan(0);
    expect(resultado.acumuladoKmPorId.get(1)).toBe(0);
    expect(resultado.acumuladoKmPorId.get(2)).toBe(resultado.totalDistanciaKm);
  });

  it('acumula distancia con puntos en orden DESC', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo(
      [
        {
          id: 2,
          lat: 19.435,
          lng: -99.13,
          fechaHora: `${base.slice(0, 11)}10:05:00`,
        },
        {
          id: 1,
          lat: 19.4326,
          lng: -99.1332,
          fechaHora: base,
        },
      ],
      { yaOrdenadoDesc: true },
    );

    expect(resultado.totalDistanciaKm).toBeGreaterThan(0);
    expect(resultado.acumuladoKmPorId.get(1)).toBe(0);
    expect(resultado.acumuladoKmPorId.get(2)).toBe(resultado.totalDistanciaKm);
  });

  it('retorna 0 si no hay puntos', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo([]);
    expect(resultado.totalDistanciaKm).toBe(0);
    expect(resultado.acumuladoKmPorId.size).toBe(0);
  });
});

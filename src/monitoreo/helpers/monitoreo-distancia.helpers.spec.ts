import {
  calcularDistanciaHistoricoMonitoreo,
  esCoordenadaValida,
} from './monitoreo-distancia.helpers';
import { MONITOREO_DISTANCIA_DEFAULTS } from './monitoreo-distancia.config';

describe('monitoreo-distancia.helpers', () => {
  const base = '2026-09-02T10:00:00';
  const umbrales = {
    saltoMaxMetros: MONITOREO_DISTANCIA_DEFAULTS.saltoGpsMetros,
    minSegmentoDetenidoMetros: MONITOREO_DISTANCIA_DEFAULTS.driftDetenidoMetros,
  };

  it('esCoordenadaValida rechaza 0,0 y coords fuera de rango', () => {
    expect(esCoordenadaValida(0, 0)).toBe(false);
    expect(esCoordenadaValida(91, 0)).toBe(false);
    expect(esCoordenadaValida(19.43, -99.13)).toBe(true);
  });

  it('descarta saltos GPS mayores al umbral', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo(
      [
      {
        id: 1,
        lat: 19.4326,
        lng: -99.1332,
        fechaHora: base,
        movimiento: 1,
        velocidad: 40,
      },
      {
        id: 2,
        lat: 20.5,
        lng: -98,
        fechaHora: `${base.slice(0, 11)}10:01:00`,
        movimiento: 1,
        velocidad: 40,
      },
      ],
      { umbrales },
    );

    expect(resultado.totalDistanciaKm).toBe(0);
    expect(resultado.acumuladoKmPorId.get(2)).toBe(0);
  });

  it('no suma drift estacionado bajo el umbral mínimo', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo(
      [
        {
          id: 1,
          lat: 19.4326,
          lng: -99.1332,
          fechaHora: base,
          movimiento: 0,
          velocidad: 0,
        },
        {
          id: 2,
          lat: 19.43261,
          lng: -99.13321,
          fechaHora: `${base.slice(0, 11)}10:01:00`,
          movimiento: 0,
          velocidad: 0,
        },
      ],
      { umbrales },
    );

    expect(resultado.totalDistanciaKm).toBe(0);
  });

  it('acumula distancia con puntos en orden DESC', () => {
    const resultado = calcularDistanciaHistoricoMonitoreo(
      [
        {
          id: 2,
          lat: 19.435,
          lng: -99.13,
          fechaHora: `${base.slice(0, 11)}10:05:00`,
          movimiento: 1,
          velocidad: 30,
        },
        {
          id: 1,
          lat: 19.4326,
          lng: -99.1332,
          fechaHora: base,
          movimiento: 1,
          velocidad: 30,
        },
      ],
      { yaOrdenadoDesc: true },
    );

    expect(resultado.totalDistanciaKm).toBeGreaterThan(0);
    expect(resultado.acumuladoKmPorId.get(1)).toBe(0);
    expect(resultado.acumuladoKmPorId.get(2)).toBe(resultado.totalDistanciaKm);
  });
});

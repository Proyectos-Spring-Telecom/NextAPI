import { EnumTipoDispositivo } from '../../common/estatus.enum';
import {
  debeEvaluarGeocerca,
  estaFueraDeAlgunaGeocerca,
  extractOuterRing,
  pointInPolygonRing,
} from './estado-geocerca.util';

const POLIGONO_CDMX = {
  type: 'Polygon',
  coordinates: [
    [
      [-99.14, 19.43],
      [-99.13, 19.43],
      [-99.13, 19.44],
      [-99.14, 19.44],
      [-99.14, 19.43],
    ],
  ],
};

describe('estado-geocerca.util', () => {
  describe('debeEvaluarGeocerca', () => {
    it('permite RASTREADOR/AVL/TELEFONO/TRACKCAM con instalación y coords', () => {
      for (const tipo of [
        EnumTipoDispositivo.RASTREADOR,
        EnumTipoDispositivo.AVL,
        EnumTipoDispositivo.TELEFONO,
        EnumTipoDispositivo.TRACKCAM,
      ]) {
        expect(
          debeEvaluarGeocerca({
            idTipoDispositivo: tipo,
            idInstalacion: 10,
            estado: 0,
            lat: 19.435,
            lng: -99.135,
          }),
        ).toBe(true);
      }
    });

    it('bloquea PANEL, sin instalación, pánico/energía o coords inválidas', () => {
      expect(
        debeEvaluarGeocerca({
          idTipoDispositivo: EnumTipoDispositivo.PANEL_ALARMA,
          idInstalacion: 10,
          estado: 0,
          lat: 19.43,
          lng: -99.13,
        }),
      ).toBe(false);

      expect(
        debeEvaluarGeocerca({
          idTipoDispositivo: EnumTipoDispositivo.AVL,
          idInstalacion: null,
          estado: 0,
          lat: 19.43,
          lng: -99.13,
        }),
      ).toBe(false);

      expect(
        debeEvaluarGeocerca({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          idInstalacion: 10,
          estado: 2,
          lat: 19.43,
          lng: -99.13,
        }),
      ).toBe(false);

      expect(
        debeEvaluarGeocerca({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          idInstalacion: 10,
          estado: 10,
          lat: 19.43,
          lng: -99.13,
        }),
      ).toBe(false);
    });
  });

  describe('point-in-polygon', () => {
    it('detecta dentro / fuera', () => {
      const ring = extractOuterRing(POLIGONO_CDMX)!;
      expect(pointInPolygonRing(-99.135, 19.435, ring)).toBe(true);
      expect(pointInPolygonRing(-99.20, 19.50, ring)).toBe(false);
    });

    it('fuera de alguna geocerca → true', () => {
      expect(
        estaFueraDeAlgunaGeocerca(19.50, -99.20, [POLIGONO_CDMX]),
      ).toBe(true);
      expect(
        estaFueraDeAlgunaGeocerca(19.435, -99.135, [POLIGONO_CDMX]),
      ).toBe(false);
    });
  });
});

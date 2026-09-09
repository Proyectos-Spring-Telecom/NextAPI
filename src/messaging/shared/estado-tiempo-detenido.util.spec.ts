import { EnumTipoDispositivo } from '../../common/estatus.enum';
import {
  debeAplicarTiempoDetenido,
  estadoPorMinutosDetenido,
  EnumEstadoTiempoDetenido,
  minutosEntre,
} from './estado-tiempo-detenido.util';

describe('estado-tiempo-detenido.util', () => {
  describe('debeAplicarTiempoDetenido', () => {
    it('aplica solo AVL/TRACKCAM con estado 0 y velocidad 0', () => {
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.AVL,
          estado: 0,
          velocidad: 0,
        }),
      ).toBe(true);
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          estado: 0,
          velocidad: 0,
        }),
      ).toBe(true);
    });

    it('no aplica si hay alerta / otro estado (prioridad)', () => {
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          estado: 2,
          velocidad: 0,
        }),
      ).toBe(false);
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.AVL,
          estado: 10,
          velocidad: 0,
        }),
      ).toBe(false);
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.AVL,
          estado: null,
          velocidad: 0,
        }),
      ).toBe(false);
    });

    it('no aplica si velocidad != 0 o tipo no elegible', () => {
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          estado: 0,
          velocidad: 1,
        }),
      ).toBe(false);
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.PANEL_ALARMA,
          estado: 0,
          velocidad: 0,
        }),
      ).toBe(false);
    });
  });

  describe('estadoPorMinutosDetenido', () => {
    it('umbrales 30 / 60 / 90', () => {
      expect(estadoPorMinutosDetenido(29.9)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO,
      );
      expect(estadoPorMinutosDetenido(30)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_30_MIN,
      );
      expect(estadoPorMinutosDetenido(59.9)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_30_MIN,
      );
      expect(estadoPorMinutosDetenido(60)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_60_MIN,
      );
      expect(estadoPorMinutosDetenido(89.9)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_60_MIN,
      );
      expect(estadoPorMinutosDetenido(90)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_90_MIN,
      );
    });
  });

  describe('minutosEntre', () => {
    it('calcula diferencia en minutos', () => {
      expect(
        minutosEntre('2026-09-08T12:00:00', '2026-09-08T13:30:00'),
      ).toBe(90);
    });
  });
});

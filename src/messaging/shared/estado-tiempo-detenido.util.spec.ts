import { EnumTipoDispositivo } from '../../common/estatus.enum';
import {
  debeAplicarTiempoDetenido,
  estadoPorMinutosDetenido,
  EnumEstadoTiempoDetenido,
  inicioConteoDetenido,
  minutosEntre,
} from './estado-tiempo-detenido.util';

describe('estado-tiempo-detenido.util', () => {
  describe('debeAplicarTiempoDetenido', () => {
    it('aplica AVL/TRACKCAM/TRACKGAS con estado 0 y velocidad 0', () => {
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
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.TRACKGAS,
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

  describe('inicioConteoDetenido (regla SION: motor encendido)', () => {
    it('NU6432A: sin encendido desde que se detuvo y llega con ignición 0 → null (gris)', () => {
      expect(
        inicioConteoDetenido({
          primerEncendidoTrasMovimiento: null,
          ignicionActual: 0,
          fechaActual: '2026-10-26T12:59:27',
        }),
      ).toBeNull();
    });

    it('F150: cuenta desde el primer encendido tras el último movimiento', () => {
      const inicio = inicioConteoDetenido({
        primerEncendidoTrasMovimiento: '2026-10-26T09:53:13',
        ignicionActual: 0,
        fechaActual: '2026-10-26T10:49:37',
      });
      expect(inicio).toBe('2026-10-26T09:53:13');
      const minutos = minutosEntre(inicio!, '2026-10-26T10:49:37')!;
      expect(estadoPorMinutosDetenido(minutos)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_30_MIN,
      );
    });

    it('primer encendido es la posición actual → 0 min (Detenido)', () => {
      const inicio = inicioConteoDetenido({
        primerEncendidoTrasMovimiento: null,
        ignicionActual: 1,
        fechaActual: '2026-10-26T09:53:13',
      });
      expect(inicio).toBe('2026-10-26T09:53:13');
      expect(estadoPorMinutosDetenido(minutosEntre(inicio!, '2026-10-26T09:53:13')!)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO,
      );
    });

    it('ignición null en la posición actual no cuenta como encendido', () => {
      expect(
        inicioConteoDetenido({
          primerEncendidoTrasMovimiento: null,
          ignicionActual: null,
          fechaActual: '2026-10-26T10:00:00',
        }),
      ).toBeNull();
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

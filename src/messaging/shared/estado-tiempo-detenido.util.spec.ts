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

    it('GPS de 1–5 km/h o sin velocidad cuenta como detenido; más de 5 o tipo no elegible no', () => {
      for (const velocidad of [1, 5, null]) {
        expect(debeAplicarTiempoDetenido({ idTipoDispositivo: EnumTipoDispositivo.TRACKCAM, estado: 0, velocidad })).toBe(true);
      }
      expect(
        debeAplicarTiempoDetenido({
          idTipoDispositivo: EnumTipoDispositivo.TRACKCAM,
          estado: 0,
          velocidad: 6,
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

  describe('inicioConteoDetenido (10/11: cuenta con motor encendido o apagado)', () => {
    const aqui = { lat: 18.89024, lng: -99.126663 };
    const p = (fechaHora: string, punto: { lat: number; lng: number } = aqui) => ({ fechaHora, ...punto });

    it('LORD 021 (10/11): estacionada con el motor apagado cuenta desde que se detuvo', () => {
      const inicio = inicioConteoDetenido([p('2026-11-10T09:29:59'), p('2026-11-10T11:00:00')]);
      expect(inicio).toBe('2026-11-10T09:29:59');
      expect(estadoPorMinutosDetenido(minutosEntre(inicio!, '2026-11-10T11:00:00')!)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_90_MIN,
      );
    });

    it('unidad 41 (6/11): llegar a 800 m sin velocidad es movimiento', () => {
      const nuevo = { lat: 18.8948, lng: -99.133087 };
      const inicio = inicioConteoDetenido([
        p('2026-11-06T21:01:03'),
        p('2026-11-06T21:28:55'),
        p('2026-11-06T21:30:44'),
        p('2026-11-06T21:33:48', nuevo),
        p('2026-11-06T21:37:11', nuevo),
      ]);
      expect(inicio).toBe('2026-11-06T21:33:48');
      expect(estadoPorMinutosDetenido(minutosEntre(inicio!, '2026-11-06T21:37:11')!)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO,
      );
    });

    it('variación de GPS de pocos metros no reinicia', () => {
      expect(
        inicioConteoDetenido([p('2026-10-26T09:00:00'), p('2026-10-26T09:40:00', { lat: 18.89034, lng: -99.12676 })]),
      ).toBe('2026-10-26T09:00:00');
    });

    it('solo la posición actual → 0 min (Detenido); sin puntos → null', () => {
      expect(inicioConteoDetenido([p('2026-10-26T09:53:13')])).toBe('2026-10-26T09:53:13');
      expect(inicioConteoDetenido([])).toBeNull();
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

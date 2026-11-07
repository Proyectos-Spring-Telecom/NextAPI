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
    const aqui = { lat: 18.89024, lng: -99.126663 };
    const p = (
      fechaHora: string,
      ignicion: number | null,
      punto: { lat: number; lng: number } = aqui,
    ) => ({ fechaHora, ignicion, ...punto });

    it('NU6432A: sin encendido desde que se detuvo y llega con ignición 0 → null (gris)', () => {
      expect(
        inicioConteoDetenido([p('2026-10-26T12:00:00', 0), p('2026-10-26T12:59:27', 0)]),
      ).toBeNull();
    });

    it('F150: cuenta desde el primer encendido del periodo con motor encendido', () => {
      const inicio = inicioConteoDetenido([
        p('2026-10-26T09:50:00', 0),
        p('2026-10-26T09:53:13', 1),
        p('2026-10-26T10:20:00', 1),
        p('2026-10-26T10:49:37', 1),
      ]);
      expect(inicio).toBe('2026-10-26T09:53:13');
      const minutos = minutosEntre(inicio!, '2026-10-26T10:49:37')!;
      expect(estadoPorMinutosDetenido(minutos)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO_30_MIN,
      );
    });

    it('motor apagado en la posición actual → null aunque antes estuviera encendido', () => {
      expect(
        inicioConteoDetenido([p('2026-10-26T09:53:13', 1), p('2026-10-26T10:49:37', 0)]),
      ).toBeNull();
    });

    it('apagar el motor reinicia el conteo', () => {
      expect(
        inicioConteoDetenido([
          p('2026-11-06T21:01:03', 1),
          p('2026-11-06T21:01:29', 0),
          p('2026-11-06T21:10:52', 0),
          p('2026-11-06T21:28:55', 1),
          p('2026-11-06T21:30:44', 1),
        ]),
      ).toBe('2026-11-06T21:28:55');
    });

    it('unidad 41 (6/11): llegar a 800 m sin velocidad es movimiento', () => {
      const nuevo = { lat: 18.8948, lng: -99.133087 };
      const inicio = inicioConteoDetenido([
        p('2026-11-06T21:01:03', 1),
        p('2026-11-06T21:28:55', 1),
        p('2026-11-06T21:30:44', 1),
        p('2026-11-06T21:33:48', 1, nuevo),
        p('2026-11-06T21:37:11', 1, nuevo),
      ]);
      expect(inicio).toBe('2026-11-06T21:33:48');
      expect(estadoPorMinutosDetenido(minutosEntre(inicio!, '2026-11-06T21:37:11')!)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO,
      );
    });

    it('variación de GPS de pocos metros no reinicia', () => {
      expect(
        inicioConteoDetenido([
          p('2026-10-26T09:00:00', 1),
          p('2026-10-26T09:40:00', 1, { lat: 18.89034, lng: -99.12676 }),
        ]),
      ).toBe('2026-10-26T09:00:00');
    });

    it('primer encendido es la posición actual → 0 min (Detenido)', () => {
      const inicio = inicioConteoDetenido([p('2026-10-26T09:53:13', 1)]);
      expect(inicio).toBe('2026-10-26T09:53:13');
      expect(estadoPorMinutosDetenido(minutosEntre(inicio!, '2026-10-26T09:53:13')!)).toBe(
        EnumEstadoTiempoDetenido.DETENIDO,
      );
    });

    it('ignición null en la posición actual vale la última conocida', () => {
      expect(inicioConteoDetenido([p('2026-10-26T10:00:00', null)])).toBeNull();
      expect(
        inicioConteoDetenido([p('2026-10-26T09:00:00', 1), p('2026-10-26T10:00:00', null)]),
      ).toBe('2026-10-26T09:00:00');
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

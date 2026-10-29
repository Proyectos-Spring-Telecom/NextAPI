import {
  descripcionAlertaAutomatica,
  esEstadoAlertaConsola,
  etiquetaEstadoPosicion,
  eventoIncidente,
  iniciaAlertaConsola,
  seguimientoAlertaRepetida,
} from './incidentes-alerta.util';

describe('incidentes-alerta.util', () => {
  it('reconoce solo los estados de alerta de Consola', () => {
    for (const e of [2, 3, 8, 9, 10, 11, '2']) {
      expect(esEstadoAlertaConsola(e)).toBe(true);
    }
    for (const e of [0, 1, 4, 5, 6, 7, null, undefined, '', 'x', 2.5]) {
      expect(esEstadoAlertaConsola(e)).toBe(false);
    }
  });

  it('inicia alerta cuando cambia el estado hacia una alerta', () => {
    expect(iniciaAlertaConsola(2, 0)).toBe(true);
    expect(iniciaAlertaConsola(8, null)).toBe(true);
    expect(iniciaAlertaConsola(9, 2)).toBe(true);
  });

  it('no inicia si la unidad ya estaba en la misma alerta', () => {
    expect(iniciaAlertaConsola(2, 2)).toBe(false);
    expect(iniciaAlertaConsola('8', 8)).toBe(false);
  });

  it('no inicia si el estado actual no es alerta', () => {
    expect(iniciaAlertaConsola(0, 2)).toBe(false);
    expect(iniciaAlertaConsola(7, 0)).toBe(false);
  });

  it('SOS y caída con el mismo estado inician cada uno su alerta', () => {
    expect(iniciaAlertaConsola(2, 2, 5, 35)).toBe(true);
    expect(iniciaAlertaConsola(2, 2, 35, 5)).toBe(true);
    expect(iniciaAlertaConsola(2, 2, 35, 35)).toBe(false);
    // Otros eventos siguen la regla por estado (flota AVL: 5 ↔ 7 no reabre).
    expect(iniciaAlertaConsola(2, 2, 5, 7)).toBe(false);
    expect(iniciaAlertaConsola(2, 2, 7, 5)).toBe(false);
  });

  it('describe el incidente con el evento cuando es SOS o caída', () => {
    expect(eventoIncidente(35)).toBe(35);
    expect(eventoIncidente(7)).toBeNull();
    expect(descripcionAlertaAutomatica(2, 35)).toBe('Alerta automática: Caída');
    expect(descripcionAlertaAutomatica(2, 5)).toBe('Alerta automática: Help Me');
    expect(descripcionAlertaAutomatica(2, 7)).toBe('Alerta automática: Alerta primaria');
  });

  it('arma el seguimiento de una alerta repetida', () => {
    expect(
      seguimientoAlertaRepetida(2, 35, { id: 1633421, lat: 18.953261, lng: -99.235965 }),
    ).toBe('Nueva alerta: Caída · ubicación 18.953261, -99.235965 · posición 1633421');
    expect(seguimientoAlertaRepetida(10, null, { id: 9, lat: 0, lng: 0 })).toBe(
      'Nueva alerta: Falta de energía · sin ubicación · posición 9',
    );
  });

  it('arma etiquetas y descripción', () => {
    expect(etiquetaEstadoPosicion(8)).toBe('Fuera de geocerca');
    expect(etiquetaEstadoPosicion(99)).toBeNull();
    expect(descripcionAlertaAutomatica(2)).toBe('Alerta automática: Alerta primaria');
    expect(descripcionAlertaAutomatica(null)).toBe('Alerta automática: Alerta');
  });
});

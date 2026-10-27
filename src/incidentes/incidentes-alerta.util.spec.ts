import {
  descripcionAlertaAutomatica,
  esEstadoAlertaConsola,
  etiquetaEstadoPosicion,
  iniciaAlertaConsola,
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

  it('arma etiquetas y descripción', () => {
    expect(etiquetaEstadoPosicion(8)).toBe('Fuera de geocerca');
    expect(etiquetaEstadoPosicion(99)).toBeNull();
    expect(descripcionAlertaAutomatica(2)).toBe('Alerta automática: Alerta primaria');
    expect(descripcionAlertaAutomatica(null)).toBe('Alerta automática: Alerta');
  });
});

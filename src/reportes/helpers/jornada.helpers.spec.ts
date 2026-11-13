import {
  armarJornada,
  clasificar,
  diasDelPeriodo,
  estimarUmbralSinDatos,
  msDeFecha,
  resumenDeJornada,
  type PuntoOperacion,
} from './jornada.helpers';

let siguienteId = 1;
function p(
  fechaHora: string,
  datos: Partial<Omit<PuntoOperacion, 'id' | 'fechaHora'>> = {},
): PuntoOperacion {
  return {
    id: siguienteId++,
    fechaHora,
    lat: 18.95,
    lng: -99.23,
    velocidad: 0,
    ignicion: null,
    idEvento: 9,
    estado: 0,
    ...datos,
  };
}

/** Un día típico: amanece apagada, sale a las 07:00, se apaga a las 07:05. */
function diaTipico(): PuntoOperacion[] {
  return [
    p('2026-11-11T22:00:00', { ignicion: 0 }),
    p('2026-11-12T07:00:00', { ignicion: 1, idEvento: 1 }),
    p('2026-11-12T07:01:00', { ignicion: 1, velocidad: 40, estado: 1 }),
    p('2026-11-12T07:01:30', { ignicion: 1, velocidad: 50, estado: 1, lat: 18.96 }),
    p('2026-11-12T07:02:00', { ignicion: 1, velocidad: 0, estado: 0, lat: 18.97 }),
    p('2026-11-12T07:05:00', { ignicion: 0, idEvento: 2, lat: 18.97 }),
    p('2026-11-12T09:05:00', { ignicion: 0, lat: 18.97 }),
  ];
}

describe('clasificar (regla del semáforo)', () => {
  it('ignición apagada siempre es apagado, aunque traiga velocidad', () => {
    expect(clasificar(30, 0)).toBe('apagado');
  });
  it('desde 5 km/h es movimiento, el mismo umbral del Estado del socket', () => {
    expect(clasificar(5, 1)).toBe('movimiento');
    expect(clasificar(12, null)).toBe('movimiento');
  });
  it('menos de 5 km/h: detenido encendido con ignición, detenido sin ella', () => {
    expect(clasificar(4, 1)).toBe('detenido_encendido');
    expect(clasificar(2, 1)).toBe('detenido_encendido');
    expect(clasificar(0, 1)).toBe('detenido_encendido');
    expect(clasificar(4, null)).toBe('detenido');
    expect(clasificar(0, null)).toBe('detenido');
    expect(clasificar(null, null)).toBe('detenido');
  });
});

describe('armarJornada', () => {
  it('primer encendido, último apagado y tramos de un día típico', () => {
    const j = armarJornada('2026-11-12', diaTipico());

    expect(j.primerEncendido).toBe('2026-11-12T07:00:00');
    expect(j.ultimoApagado).toBe('2026-11-12T07:05:00');
    expect(j.encendidoDesdeDiaAnterior).toBe(false);
    expect(j.terminaEncendido).toBe(false);
    expect(j.jornadaMin).toBe(5);
    expect(j.ciclosMotor).toBe(1);
    expect(j.reportaIgnicion).toBe(true);

    expect(j.tramos.map((t) => [t.tipo, t.inicio, t.fin])).toEqual([
      ['apagado', '2026-11-12T00:00:00', '2026-11-12T07:00:00'],
      ['detenido_encendido', '2026-11-12T07:00:00', '2026-11-12T07:01:00'],
      ['movimiento', '2026-11-12T07:01:00', '2026-11-12T07:02:00'],
      ['detenido_encendido', '2026-11-12T07:02:00', '2026-11-12T07:05:00'],
      ['apagado', '2026-11-12T07:05:00', '2026-11-13T00:00:00'],
    ]);
    expect(j.tiempos).toEqual({
      movimientoMin: 1,
      detenidoEncendidoMin: 4,
      apagadoMin: 1435,
      detenidoMin: 0,
      sinDatosMin: 0,
    });
    expect(j.horasMotor).toBe(0.08);
    expect(j.velocidadMax).toBe(50);
    expect(j.km).toBeGreaterThan(2);
    expect(j.ciclos[0]).toMatchObject({
      encendido: '2026-11-12T07:00:00',
      apagado: '2026-11-12T07:05:00',
      min: 5,
      detenidoEncendidoMin: 4,
      velocidadMax: 50,
    });
  });

  it('cambios de estado contra el estado con que amaneció', () => {
    const j = armarJornada('2026-11-12', diaTipico());
    expect(j.cambiosEstado.map((c) => [c.fechaHora, c.estado, c.nombre])).toEqual([
      ['2026-11-12T07:01:00', 1, 'Movimiento'],
      ['2026-11-12T07:02:00', 0, 'Detenido'],
    ]);
  });

  it('lista los eventos no informativos (exceso, pánico) y cuenta los excesos', () => {
    const puntos = diaTipico();
    puntos.splice(
      3,
      0,
      p('2026-11-12T07:01:15', { ignicion: 1, velocidad: 95, idEvento: 6, estado: 7 }),
    );
    const j = armarJornada('2026-11-12', puntos);
    expect(j.excesosVelocidad).toBe(1);
    expect(j.eventos).toEqual([
      expect.objectContaining({
        fechaHora: '2026-11-12T07:01:15',
        idEvento: 6,
        estado: 7,
      }),
    ]);
  });

  it('un hueco largo con motor encendido es sin_datos y queda dentro del ciclo', () => {
    const puntos = [
      p('2026-11-12T08:00:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:01:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:02:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:03:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:40:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:41:00', { ignicion: 0 }),
    ];
    const j = armarJornada('2026-11-12', puntos);
    expect(j.tramos.map((t) => t.tipo)).toEqual([
      'sin_datos',
      'movimiento',
      'sin_datos',
      'movimiento',
      'apagado',
    ]);
    expect(j.ciclos).toHaveLength(1);
    expect(j.ciclos[0]).toMatchObject({
      encendido: '2026-11-12T08:00:00',
      apagado: '2026-11-12T08:41:00',
      sinDatosMin: 37,
    });
    // Antes de la primera posición sin saber cómo amaneció: sin datos.
    expect(j.tramos[0]).toMatchObject({
      inicio: '2026-11-12T00:00:00',
      fin: '2026-11-12T08:00:00',
    });
  });

  it('apagado, los reportes espaciados (cada 2 h) siguen siendo apagado', () => {
    const puntos = [
      p('2026-11-12T01:00:00', { ignicion: 0 }),
      p('2026-11-12T03:00:00', { ignicion: 0 }),
      p('2026-11-12T05:00:00', { ignicion: 0 }),
    ];
    const j = armarJornada('2026-11-12', puntos);
    expect(j.tramos).toHaveLength(1);
    expect(j.tramos[0]).toMatchObject({ tipo: 'apagado', min: 1440 });
    expect(j.primerEncendido).toBeNull();
    expect(j.ciclosMotor).toBe(0);
  });

  it('cruza la medianoche: el día termina encendido y el siguiente lo hereda', () => {
    const puntos = [
      p('2026-11-12T23:50:00', { ignicion: 1, idEvento: 1 }),
      p('2026-11-12T23:55:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-13T00:03:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-13T00:10:00', { ignicion: 0, idEvento: 2 }),
    ];
    const hoy = armarJornada('2026-11-12', puntos);
    expect(hoy.terminaEncendido).toBe(true);
    expect(hoy.ultimoApagado).toBeNull();
    expect(hoy.ciclos[0]).toMatchObject({
      encendido: '2026-11-12T23:50:00',
      apagado: null,
      min: 10,
    });
    expect(hoy.tramos[hoy.tramos.length - 1].fin).toBe('2026-11-13T00:00:00');

    const manana = armarJornada('2026-11-13', puntos);
    expect(manana.encendidoDesdeDiaAnterior).toBe(true);
    expect(manana.primerEncendido).toBe('2026-11-13T00:00:00');
    expect(manana.ultimoApagado).toBe('2026-11-13T00:10:00');
    expect(manana.tramos[0]).toMatchObject({
      tipo: 'movimiento',
      inicio: '2026-11-13T00:00:00',
    });
  });

  it('el último tramo del día se cierra con la posición de después de medianoche', () => {
    const puntos = [
      p('2026-11-12T23:40:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-12T23:45:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-12T23:50:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-12T23:55:00', { ignicion: 1, velocidad: 20 }),
      p('2026-11-13T00:20:00', { ignicion: 1, velocidad: 20 }),
    ];
    const hoy = armarJornada('2026-11-12', puntos);
    const manana = armarJornada('2026-11-13', puntos);
    expect(hoy.tramos[hoy.tramos.length - 1]).toMatchObject({
      tipo: 'sin_datos',
      inicio: '2026-11-12T23:55:00',
    });
    expect(manana.tramos[0]).toMatchObject({
      tipo: 'sin_datos',
      inicio: '2026-11-13T00:00:00',
    });
  });

  it('el día en curso termina en ahora', () => {
    const puntos = [
      p('2026-11-13T08:00:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-13T08:05:00', { ignicion: 1, velocidad: 30 }),
    ];
    const j = armarJornada('2026-11-13', puntos, {
      ahoraMs: msDeFecha('2026-11-13T08:07:00'),
    });
    const ultimo = j.tramos[j.tramos.length - 1];
    expect(ultimo).toMatchObject({ tipo: 'movimiento', fin: '2026-11-13T08:07:00' });
    expect(j.terminaEncendido).toBe(true);
    expect(j.jornadaMin).toBe(7);
  });

  it('equipo sin ignición (teléfono): detenido/movimiento y sin ciclos de motor', () => {
    const puntos = [
      p('2026-11-12T09:00:00', { velocidad: 0 }),
      p('2026-11-12T09:05:00', { velocidad: 25 }),
      p('2026-11-12T09:06:00', { velocidad: 0 }),
    ];
    const j = armarJornada('2026-11-12', puntos);
    expect(j.reportaIgnicion).toBe(false);
    expect(j.ciclosMotor).toBe(0);
    expect(j.primerMovimiento).toBe('2026-11-12T09:05:00');
    expect(j.ultimoMovimiento).toBe('2026-11-12T09:06:00');
    expect(j.tramos.map((t) => t.tipo)).toContain('detenido');
  });

  it('sin coordenada medida no suma distancia', () => {
    const puntos = [
      p('2026-11-12T08:00:00', { ignicion: 1, velocidad: 30 }),
      p('2026-11-12T08:01:00', { ignicion: 1, velocidad: 30, lat: null, lng: null }),
      p('2026-11-12T08:02:00', { ignicion: 1, velocidad: 30, lat: 19.5 }),
    ];
    expect(armarJornada('2026-11-12', puntos).km).toBe(0);
  });

  it('sin posiciones el día es sin datos', () => {
    const j = armarJornada('2026-11-12', []);
    expect(j.tramos).toEqual([expect.objectContaining({ tipo: 'sin_datos', min: 1440 })]);
    expect(j.posiciones).toBe(0);
  });

  it('el resumen no lleva listas', () => {
    const r = resumenDeJornada(armarJornada('2026-11-12', diaTipico()));
    expect(r).not.toHaveProperty('tramos');
    expect(r).not.toHaveProperty('eventos');
    expect(r.primerEncendido).toBe('2026-11-12T07:00:00');
  });
});

describe('estimarUmbralSinDatos', () => {
  it('el doble de la mediana del intervalo encendido, mínimo 10 min', () => {
    const cada30s = Array.from({ length: 10 }, (_, i) =>
      p(`2026-11-12T08:00:${String(i * 5).padStart(2, '0')}`, { ignicion: 1 }),
    );
    expect(estimarUmbralSinDatos(cada30s)).toBe(10);
    const cada8min = ['08:00', '08:08', '08:16', '08:24'].map((h) =>
      p(`2026-11-12T${h}:00`, { ignicion: 1 }),
    );
    expect(estimarUmbralSinDatos(cada8min)).toBe(16);
  });
});

describe('diasDelPeriodo', () => {
  it('incluye ambos extremos', () => {
    expect(diasDelPeriodo('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

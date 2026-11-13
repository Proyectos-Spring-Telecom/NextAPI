import { armarJornada, type PuntoOperacion } from './jornada.helpers';
import { paradasDeJornada, ubicarParada, type LugaresVehiculo } from './paradas.helpers';

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
    ignicion: 1,
    idEvento: 9,
    estado: 0,
    ...datos,
  };
}

/** Sale a las 08:00, para en un semáforo, se estaciona con motor encendido y lo apaga. */
function recorrido(): PuntoOperacion[] {
  return [
    p('2026-11-11T22:00:00', { ignicion: 0 }),
    p('2026-11-12T08:00:00', { velocidad: 30 }),
    p('2026-11-12T08:05:00', { velocidad: 0, lat: 18.96 }),
    p('2026-11-12T08:06:00', { velocidad: 40, lat: 18.96 }),
    p('2026-11-12T08:10:00', { velocidad: 0, lat: 18.97, lng: -99.24 }),
    p('2026-11-12T08:15:00', { ignicion: 0, lat: 18.97, lng: -99.24 }),
    p('2026-11-12T09:00:00', { velocidad: 20, lat: 18.97, lng: -99.24 }),
    p('2026-11-12T09:05:00', { velocidad: 0, ignicion: 0, lat: 18.98 }),
  ];
}

describe('paradasDeJornada', () => {
  const paradas = paradasDeJornada(armarJornada('2026-11-12', recorrido()));

  it('cada racha detenida o apagada es una parada, sin mínimo', () => {
    expect(paradas.map((x) => [x.inicio, x.fin, x.motor])).toEqual([
      ['2026-11-12T00:00:00', '2026-11-12T08:00:00', 'apagado'],
      ['2026-11-12T08:05:00', '2026-11-12T08:06:00', 'encendido'],
      ['2026-11-12T08:10:00', '2026-11-12T09:00:00', 'mixto'],
      ['2026-11-12T09:05:00', '2026-11-13T00:00:00', 'apagado'],
    ]);
  });

  it('separa minutos con motor encendido y apagado', () => {
    expect(paradas[2]).toMatchObject({
      min: 50,
      motorEncendidoMin: 5,
      apagadoMin: 45,
      lat: 18.97,
      lng: -99.24,
    });
  });

  it('marca las que cruzan la medianoche', () => {
    expect(paradas[0]).toMatchObject({
      continuaDelDiaAnterior: true,
      continuaAlDiaSiguiente: false,
    });
    expect(paradas[3]).toMatchObject({
      continuaDelDiaAnterior: false,
      continuaAlDiaSiguiente: true,
    });
    expect(paradas[1]).toMatchObject({
      continuaDelDiaAnterior: false,
      continuaAlDiaSiguiente: false,
    });
  });

  it('un hueco sin datos corta la parada', () => {
    const puntos = [
      p('2026-11-12T08:00:00', { velocidad: 30 }),
      p('2026-11-12T08:01:00', { velocidad: 30 }),
      p('2026-11-12T08:02:00', { velocidad: 30 }),
      p('2026-11-12T08:03:00', { velocidad: 0 }),
      p('2026-11-12T08:04:00', { velocidad: 0 }),
      p('2026-11-12T09:00:00', { velocidad: 0 }),
      p('2026-11-12T09:01:00', { velocidad: 30 }),
    ];
    const ps = paradasDeJornada(armarJornada('2026-11-12', puntos));
    expect(
      ps.filter(
        (x) =>
          x.inicio.startsWith('2026-11-12T08') || x.inicio.startsWith('2026-11-12T09'),
      ),
    ).toEqual([
      expect.objectContaining({
        inicio: '2026-11-12T08:03:00',
        fin: '2026-11-12T08:04:00',
      }),
      expect.objectContaining({
        inicio: '2026-11-12T09:00:00',
        fin: '2026-11-12T09:01:00',
      }),
    ]);
  });

  it('equipo sin ignición: motor sin_ignicion', () => {
    const puntos = [
      p('2026-11-12T08:00:00', { ignicion: null, velocidad: 20 }),
      p('2026-11-12T08:05:00', { ignicion: null, velocidad: 0 }),
      p('2026-11-12T08:09:00', { ignicion: null, velocidad: 20 }),
    ];
    const ps = paradasDeJornada(armarJornada('2026-11-12', puntos));
    expect(ps.find((x) => x.inicio === '2026-11-12T08:05:00')?.motor).toBe(
      'sin_ignicion',
    );
  });
});

describe('ubicarParada', () => {
  const lugares: LugaresVehiculo = {
    geocercas: [
      {
        id: 1,
        nombre: 'Base',
        ring: [
          [-99.25, 18.96],
          [-99.23, 18.96],
          [-99.23, 18.98],
          [-99.25, 18.98],
          [-99.25, 18.96],
        ],
      },
      {
        id: 2,
        nombre: 'Lejos',
        ring: [
          [-98.0, 19.0],
          [-97.9, 19.0],
          [-97.9, 19.1],
          [-98.0, 19.0],
        ],
      },
    ],
    puntos: [
      { id: 10, nombre: 'Cliente cerca', lat: 18.9701, lng: -99.2401, radioMetros: 50 },
      { id: 11, nombre: 'Cliente más cerca', lat: 18.97, lng: -99.24, radioMetros: 20 },
      { id: 12, nombre: 'Fuera de radio', lat: 18.975, lng: -99.24, radioMetros: 25 },
    ],
  };
  const parada = paradasDeJornada(armarJornada('2026-11-12', recorrido()))[2];

  it('geocercas que la contienen y el punto de interés más cercano en su radio', () => {
    const u = ubicarParada(parada, lugares);
    expect(u.geocercas).toEqual([{ id: 1, nombre: 'Base' }]);
    expect(u.puntoInteres).toEqual({
      id: 11,
      nombre: 'Cliente más cerca',
      distanciaM: 0,
    });
  });

  it('sin lugares o sin coordenada, la deja igual', () => {
    expect(ubicarParada(parada, undefined)).toBe(parada);
    const sinCoord = { ...parada, lat: null, lng: null };
    expect(ubicarParada(sinCoord, lugares)).toBe(sinCoord);
  });
});

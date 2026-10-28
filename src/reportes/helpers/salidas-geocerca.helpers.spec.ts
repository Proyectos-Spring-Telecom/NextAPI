import { extractOuterRing } from 'src/messaging/shared/estado-geocerca.util';
import {
  codificarCursorRecorrido,
  decodificarCursorRecorrido,
  detectarHuecosTransmision,
  detectarSalidasGeocerca,
  estadoRespectoGeocerca,
  fusionarSegmentosConsecutivos,
  type PosicionCronologicaGeocerca,
} from './salidas-geocerca.helpers';

const POLIGONO = {
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
const RING = extractOuterRing(POLIGONO)!;
const DENTRO = { lat: 19.435, lng: -99.135 };
const FUERA = { lat: 19.5, lng: -99.2 };

function pos(
  id: number,
  hora: string,
  punto: { lat: number; lng: number },
): PosicionCronologicaGeocerca {
  return { id, ...punto, fechaHora: `2026-10-15T${hora}` };
}

describe('detectarSalidasGeocerca', () => {
  it('detecta 2 salidas con reingreso en la secuencia del ejemplo', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posiciones: [
        pos(1, '08:00:00', DENTRO),
        pos(2, '08:05:00', DENTRO),
        pos(3, '08:10:00', FUERA),
        pos(4, '08:15:00', FUERA),
        pos(5, '08:30:00', DENTRO),
        pos(6, '09:00:00', FUERA),
      ],
    });
    expect(salidas).toHaveLength(2);
    expect(salidas[0]).toMatchObject({
      fechaSalida: '2026-10-15T08:10:00',
      fechaReingreso: '2026-10-15T08:30:00',
      duracionFueraSegundos: 1200,
      estadoEvento: 'REINGRESO_DETECTADO',
    });
    expect(salidas[0].ultimaPosicionDentro?.fechaHora).toBe(
      '2026-10-15T08:05:00',
    );
    expect(salidas[0].posicionReingreso).toMatchObject({
      fechaHora: '2026-10-15T08:30:00',
      ...DENTRO,
    });
    expect(salidas[1].posicionReingreso).toBeNull();
    expect(salidas[1]).toMatchObject({
      fechaSalida: '2026-10-15T09:00:00',
      fechaReingreso: null,
      duracionFueraSegundos: null,
      estadoEvento: 'SIN_REINGRESO',
    });
  });

  it('no confirma salida si la primera posición ya está fuera y no hay anterior', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posiciones: [pos(1, '08:00:00', FUERA), pos(2, '08:30:00', DENTRO)],
    });
    expect(salidas).toHaveLength(0);
  });

  it('confirma la salida inicial si la posición anterior estaba dentro', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posicionAnterior: pos(0, '07:55:00', DENTRO),
      posiciones: [pos(1, '08:00:00', FUERA), pos(2, '08:20:00', DENTRO)],
    });
    expect(salidas).toHaveLength(1);
    expect(salidas[0].ultimaPosicionDentro?.fechaHora).toBe(
      '2026-10-15T07:55:00',
    );
    expect(salidas[0].duracionFueraSegundos).toBe(1200);
  });

  it('no confirma si la posición anterior ya estaba fuera', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posicionAnterior: pos(0, '07:55:00', FUERA),
      posiciones: [pos(1, '08:00:00', FUERA), pos(2, '08:20:00', DENTRO)],
    });
    expect(salidas).toHaveLength(0);
  });

  it('ignora duplicadas y coordenadas inválidas sin generar salidas extra', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posiciones: [
        pos(1, '08:00:00', DENTRO),
        pos(2, '08:10:00', FUERA),
        pos(3, '08:10:00', FUERA), // duplicada
        { id: 4, lat: 0, lng: 0, fechaHora: '2026-10-15T08:12:00' },
        { id: 5, lat: 999, lng: -99, fechaHora: '2026-10-15T08:13:00' },
        pos(6, '08:20:00', FUERA),
      ],
    });
    expect(salidas).toHaveLength(1);
    expect(salidas[0].estadoEvento).toBe('SIN_REINGRESO');
  });

  it('varias geocercas: la misma serie produce salidas independientes por polígono', () => {
    const otra = detectarSalidasGeocerca({
      ring: RING,
      posiciones: [pos(1, '08:00:00', DENTRO), pos(2, '08:10:00', FUERA)],
    });
    expect(otra).toHaveLength(1);
    // Un polígono que contiene ambos puntos no genera salida con la misma serie.
    const ringAmplio = extractOuterRing({
      type: 'Polygon',
      coordinates: [
        [
          [-100, 19],
          [-99, 19],
          [-99, 20],
          [-100, 20],
          [-100, 19],
        ],
      ],
    })!;
    expect(
      detectarSalidasGeocerca({
        ring: ringAmplio,
        posiciones: [pos(1, '08:00:00', DENTRO), pos(2, '08:10:00', FUERA)],
      }),
    ).toHaveLength(0);
  });

  it('sin posiciones dentro no hay salidas', () => {
    expect(
      detectarSalidasGeocerca({
        ring: RING,
        posiciones: [pos(1, '08:00:00', FUERA)],
      }),
    ).toHaveLength(0);
    expect(
      detectarSalidasGeocerca({ ring: RING, posiciones: [] }),
    ).toHaveLength(0);
  });
});

describe('recorrido: estado, cursor y huecos', () => {
  it('tres salidas en la serie: el detector conserva 3 eventos', () => {
    const salidas = detectarSalidasGeocerca({
      ring: RING,
      posiciones: [
        pos(1, '16:00:00', DENTRO),
        pos(2, '16:10:00', FUERA),
        pos(3, '16:12:00', FUERA),
        pos(4, '16:18:00', DENTRO),
        pos(5, '16:19:00', FUERA),
        pos(6, '16:20:00', DENTRO),
        pos(7, '16:22:00', FUERA),
        pos(8, '17:30:00', FUERA),
      ],
    });
    expect(salidas.map((s) => s.fechaSalida)).toEqual([
      '2026-10-15T16:10:00',
      '2026-10-15T16:19:00',
      '2026-10-15T16:22:00',
    ]);
  });

  it('estadoRespectoGeocerca distingue dentro/fuera e inválidas', () => {
    expect(estadoRespectoGeocerca(DENTRO.lat, DENTRO.lng, RING)).toBe('DENTRO');
    expect(estadoRespectoGeocerca(FUERA.lat, FUERA.lng, RING)).toBe('FUERA');
    expect(estadoRespectoGeocerca(0, 0, RING)).toBeNull();
  });

  it('cursor de recorrido hace round-trip y rechaza basura', () => {
    const c = codificarCursorRecorrido('2026-10-20T16:22:24', 1001);
    expect(decodificarCursorRecorrido(c)).toEqual({
      fechaHora: '2026-10-20T16:22:24',
      idPosicion: 1001,
    });
    expect(() => decodificarCursorRecorrido('!!nope!!')).toThrow();
  });

  it('detecta huecos de transmisión mayores al umbral', () => {
    const huecos = detectarHuecosTransmision(
      [
        { fechaHora: '2026-10-15T16:00:00' },
        { fechaHora: '2026-10-15T16:05:00' },
        { fechaHora: '2026-10-15T17:30:00' },
      ],
      900,
    );
    expect(huecos).toEqual([
      {
        desde: '2026-10-15T16:05:00',
        hasta: '2026-10-15T17:30:00',
        duracionSegundos: 5100,
      },
    ]);
  });
});

describe('fusionarSegmentosConsecutivos (cambio de dispositivo)', () => {
  const seg = (imei: string, desde: string, hasta: string) => ({
    imei,
    desde,
    hasta,
  });

  it('fusiona tramos contiguos del mismo IMEI y conserva el cambio a otro IMEI', () => {
    const fusionados = fusionarSegmentosConsecutivos([
      seg('222', '2026-10-10 00:00:00', '2026-10-20 23:59:59'),
      seg('111', '2026-10-01 00:00:00', '2026-10-10 00:00:00'),
      seg('111', '2026-10-05 00:00:00', '2026-10-10 00:00:00'),
    ]);
    expect(fusionados).toEqual([
      seg('111', '2026-10-01 00:00:00', '2026-10-10 00:00:00'),
      seg('222', '2026-10-10 00:00:00', '2026-10-20 23:59:59'),
    ]);
  });

  it('no fusiona el mismo IMEI en tramos separados en el tiempo', () => {
    const fusionados = fusionarSegmentosConsecutivos([
      seg('111', '2026-10-01 00:00:00', '2026-10-05 00:00:00'),
      seg('111', '2026-10-08 00:00:00', '2026-10-20 23:59:59'),
    ]);
    expect(fusionados).toHaveLength(2);
  });
});

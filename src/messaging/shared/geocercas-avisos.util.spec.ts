import { dentroDeGeocerca, distanciaAlBordeMetros } from './geocercas-avisos.util';

// Cuadro de ~1.1 km de lado en Cuernavaca, en [lng, lat].
const ring: Array<[number, number]> = [
  [-99.24, 18.95],
  [-99.23, 18.95],
  [-99.23, 18.96],
  [-99.24, 18.96],
  [-99.24, 18.95],
];

describe('dentroDeGeocerca', () => {
  it('dentro del polígono entra', () => {
    expect(dentroDeGeocerca(-99.235, 18.955, ring)).toBe(true);
  });

  it('fuera y lejos de la orilla sale', () => {
    expect(dentroDeGeocerca(-99.22, 18.955, ring)).toBe(false);
  });

  it('fuera pero a menos de 15 m de la orilla se queda como estaba', () => {
    // ~5 m al este del borde x = -99.23.
    expect(dentroDeGeocerca(-99.22995, 18.955, ring)).toBeNull();
  });
});

describe('distanciaAlBordeMetros', () => {
  it('mide contra el lado más cercano', () => {
    // 0.001° de longitud a 18.955° ≈ 105 m.
    const d = distanciaAlBordeMetros(-99.229, 18.955, ring);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(110);
  });
});

import { dentroDelPunto, margenSalidaMetros } from './puntos-interes-avisos.service';

describe('Llegada y salida de un punto de interés', () => {
  it('llega dentro del radio y sale solo pasando el margen de la orilla', () => {
    expect(margenSalidaMetros(25)).toBe(15);
    expect(margenSalidaMetros(500)).toBe(100);
    expect(dentroDelPunto(20, 25)).toBe(true);
    expect(dentroDelPunto(25, 25)).toBe(true);
    // En la orilla (25–40 m) se queda como estaba: no avisa por el ruido del GPS.
    expect(dentroDelPunto(30, 25)).toBeNull();
    expect(dentroDelPunto(41, 25)).toBe(false);
  });
});

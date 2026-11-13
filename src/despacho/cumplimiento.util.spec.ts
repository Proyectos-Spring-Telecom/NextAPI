import { evaluarParada, resumir, type ParadaPlan } from './cumplimiento.util';
import { msDeFecha, type PuntoOperacion } from 'src/reportes/helpers/jornada.helpers';

let id = 1;
const pt = (fechaHora: string, lat: number, lng: number): PuntoOperacion => ({
  id: id++,
  fechaHora,
  lat,
  lng,
  velocidad: 0,
  ignicion: 1,
  idEvento: 9,
  estado: 0,
});

const almacen: ParadaPlan = {
  orden: 1,
  idPuntoInteres: 10,
  nombre: 'Almacén',
  lat: 20.5675,
  lng: -100.4175,
  radioMetros: 100,
  ventanaDesde: '2026-11-13 08:00:00',
  ventanaHasta: '2026-11-13 09:00:00',
};
const cliente: ParadaPlan = {
  ...almacen,
  orden: 2,
  idPuntoInteres: 11,
  nombre: 'Cliente',
  lat: 20.53,
  lng: -100.44,
};

// Recorrido: almacén 08:10–08:30, sale, llega al cliente 09:20 (tarde) y se queda.
const recorrido = [
  pt('2026-11-13T07:50:00', 20.6, -100.4),
  pt('2026-11-13T08:10:00', 20.5675, -100.4175),
  pt('2026-11-13T08:20:00', 20.5676, -100.4176),
  pt('2026-11-13T08:30:00', 20.56, -100.42),
  pt('2026-11-13T09:20:00', 20.5301, -100.4401),
];
const INI = '2026-11-13 07:00:00';
const FIN = '2026-11-13 18:00:00';
const ahora = (f: string) => msDeFecha(f);

describe('evaluarParada', () => {
  it('llegada y salida a tiempo', () => {
    const r = evaluarParada(almacen, recorrido, INI, FIN, ahora('2026-11-13T10:00:00'));
    expect(r).toMatchObject({
      llegada: '2026-11-13T08:10:00',
      salida: '2026-11-13T08:30:00',
      minutosEnSitio: 20,
      estado: 'a_tiempo',
    });
  });

  it('sigue en el sitio mientras no sale y el trabajo no termina', () => {
    const r = evaluarParada(cliente, recorrido, INI, FIN, ahora('2026-11-13T10:00:00'));
    expect(r).toMatchObject({
      llegada: '2026-11-13T09:20:00',
      salida: null,
      estado: 'en_sitio',
    });
  });

  it('tarde cuando llega después de la ventana (ya terminado el trabajo)', () => {
    const r = evaluarParada(cliente, recorrido, INI, FIN, ahora('2026-11-13T19:00:00'));
    expect(r.estado).toBe('tarde');
  });

  it('no visitada al pasar la ventana sin llegar; pendiente antes', () => {
    const lejos = { ...almacen, lat: 19.0, lng: -99.0 };
    expect(
      evaluarParada(lejos, recorrido, INI, FIN, ahora('2026-11-13T08:30:00')).estado,
    ).toBe('pendiente');
    expect(
      evaluarParada(lejos, recorrido, INI, FIN, ahora('2026-11-13T09:30:00')).estado,
    ).toBe('no_visitada');
  });

  it('sin ventana: visitada', () => {
    const r = evaluarParada(
      { ...almacen, ventanaDesde: null, ventanaHasta: null },
      recorrido,
      INI,
      FIN,
      ahora('2026-11-13T10:00:00'),
    );
    expect(r.estado).toBe('visitada');
  });

  it('las posiciones fuera del trabajo no cuentan', () => {
    const r = evaluarParada(
      almacen,
      recorrido,
      '2026-11-13 08:15:00',
      FIN,
      ahora('2026-11-13T10:00:00'),
    );
    expect(r.llegada).toBe('2026-11-13T08:20:00');
  });

  it('sin coordenada medida no cuenta como llegada', () => {
    const sinGps = [{ ...pt('2026-11-13T08:10:00', 0, 0), lat: null, lng: null }];
    expect(
      evaluarParada(almacen, sinGps, INI, FIN, ahora('2026-11-13T08:20:00')).llegada,
    ).toBeNull();
  });
});

describe('resumir', () => {
  it('completado cuando todas se visitaron y ya salió de la última', () => {
    const t = ahora('2026-11-13T19:00:00');
    const ps = [almacen, cliente].map((p) =>
      evaluarParada(
        p,
        [...recorrido, pt('2026-11-13T09:40:00', 20.6, -100.4)],
        INI,
        FIN,
        t,
      ),
    );
    expect(resumir(ps, INI, FIN, t, false)).toEqual({
      estado: 'completado',
      totalParadas: 2,
      visitadas: 2,
      aTiempo: 1,
      tarde: 1,
      noVisitadas: 0,
      enOrden: true,
    });
  });

  it('programado, en curso, incompleto y cancelado', () => {
    const lejos = { ...almacen, lat: 19.0, lng: -99.0 };
    const antes = ahora('2026-11-13T06:00:00');
    const durante = ahora('2026-11-13T07:30:00');
    const despues = ahora('2026-11-13T19:00:00');
    const ev = (t: number) => [evaluarParada(lejos, recorrido, INI, FIN, t)];
    expect(resumir(ev(antes), INI, FIN, antes, false).estado).toBe('programado');
    expect(resumir(ev(durante), INI, FIN, durante, false).estado).toBe('en_curso');
    expect(resumir(ev(despues), INI, FIN, despues, false).estado).toBe('incompleto');
    expect(resumir(ev(despues), INI, FIN, despues, true).estado).toBe('cancelado');
  });

  it('detecta visitas fuera de orden', () => {
    const t = ahora('2026-11-13T19:00:00');
    const ps = [
      {
        ...evaluarParada(almacen, recorrido, INI, FIN, t),
        llegada: '2026-11-13T10:00:00',
      },
      {
        ...evaluarParada(cliente, recorrido, INI, FIN, t),
        llegada: '2026-11-13T09:00:00',
      },
    ];
    expect(resumir(ps, INI, FIN, t, false).enOrden).toBe(false);
  });
});

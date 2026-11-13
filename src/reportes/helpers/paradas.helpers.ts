import { distanciaMetros } from 'src/utils/recorrido.utils';
import { pointInPolygonRing } from 'src/messaging/shared/estado-geocerca.util';
import type { JornadaDia, TipoTramo } from './jornada.helpers';

/**
 * Paradas de una jornada (docs/fis-fiber, ruta del back §3.2): rachas de
 * tramos detenidos o apagados, con la regla del semáforo y sin mínimo de
 * minutos (el front filtra las cortas). Un hueco `sin_datos` corta la parada:
 * no se sabe si la unidad siguió ahí. La dirección la pone el front con
 * OpenStreetMap a partir de `lat` / `lng`.
 */
export type MotorParada = 'encendido' | 'apagado' | 'mixto' | 'sin_ignicion';

export type LugarParada = { id: number; nombre: string };

export type Parada = {
  fecha: string;
  inicio: string;
  fin: string;
  min: number;
  motor: MotorParada;
  motorEncendidoMin: number;
  apagadoMin: number;
  lat: number | null;
  lng: number | null;
  /** Empezó antes de las 00:00 (el día anterior tiene la otra parte). */
  continuaDelDiaAnterior: boolean;
  /** Sigue después de las 23:59 (o sigue ahora, si es hoy). */
  continuaAlDiaSiguiente: boolean;
  geocercas: LugarParada[];
  puntoInteres: (LugarParada & { distanciaM: number }) | null;
};

export type LugaresVehiculo = {
  geocercas: Array<LugarParada & { ring: Array<[number, number]> }>;
  puntos: Array<LugarParada & { lat: number; lng: number; radioMetros: number }>;
};

const DETENIDA: ReadonlySet<TipoTramo> = new Set([
  'detenido_encendido',
  'apagado',
  'detenido',
]);

/** Paradas de un día, en orden. */
export function paradasDeJornada(j: JornadaDia): Parada[] {
  const paradas: Parada[] = [];
  const inicioDia = `${j.fecha}T00:00:00`;
  const ultimoFin = j.tramos.length ? j.tramos[j.tramos.length - 1].fin : null;
  let actual: Parada | null = null;

  for (const t of j.tramos) {
    if (!DETENIDA.has(t.tipo)) {
      if (actual) paradas.push(actual);
      actual = null;
      continue;
    }
    if (!actual) {
      actual = {
        fecha: j.fecha,
        inicio: t.inicio,
        fin: t.fin,
        min: 0,
        motor: 'sin_ignicion',
        motorEncendidoMin: 0,
        apagadoMin: 0,
        lat: t.lat,
        lng: t.lng,
        continuaDelDiaAnterior: t.inicio === inicioDia,
        continuaAlDiaSiguiente: false,
        geocercas: [],
        puntoInteres: null,
      };
    }
    actual.fin = t.fin;
    actual.min = Math.round((actual.min + t.min) * 10) / 10;
    if (t.tipo === 'detenido_encendido') actual.motorEncendidoMin += t.min;
    if (t.tipo === 'apagado') actual.apagadoMin += t.min;
    if (actual.lat == null && t.lat != null) {
      actual.lat = t.lat;
      actual.lng = t.lng;
    }
  }
  if (actual) paradas.push(actual);

  return paradas.map((p) => ({
    ...p,
    motorEncendidoMin: Math.round(p.motorEncendidoMin * 10) / 10,
    apagadoMin: Math.round(p.apagadoMin * 10) / 10,
    motor: motorDe(p.motorEncendidoMin, p.apagadoMin, j.reportaIgnicion),
    // La última racha del día: la unidad seguía detenida a las 23:59 (o ahora).
    continuaAlDiaSiguiente: p.fin === ultimoFin,
  }));
}

function motorDe(
  encendidoMin: number,
  apagadoMin: number,
  reportaIgnicion: boolean,
): MotorParada {
  if (!reportaIgnicion) return 'sin_ignicion';
  if (encendidoMin > 0 && apagadoMin > 0) return 'mixto';
  return apagadoMin > 0 ? 'apagado' : 'encendido';
}

/**
 * Geocercas que contienen la parada y el punto de interés más cercano dentro
 * de su radio. Sin coordenada medida no se ubica.
 */
export function ubicarParada(
  parada: Parada,
  lugares: LugaresVehiculo | undefined,
): Parada {
  if (!lugares || parada.lat == null || parada.lng == null) return parada;
  const { lat, lng } = parada;
  const geocercas = lugares.geocercas
    .filter((g) => pointInPolygonRing(lng, lat, g.ring))
    .map(({ id, nombre }) => ({ id, nombre }));
  let puntoInteres: Parada['puntoInteres'] = null;
  for (const poi of lugares.puntos) {
    const d = distanciaMetros({ lat, lng }, { lat: poi.lat, lng: poi.lng });
    if (d <= poi.radioMetros && (!puntoInteres || d < puntoInteres.distanciaM)) {
      puntoInteres = { id: poi.id, nombre: poi.nombre, distanciaM: Math.round(d) };
    }
  }
  return { ...parada, geocercas, puntoInteres };
}

import { pointInPolygonRing } from './estado-geocerca.util';

/** Margen para dar por salida (el ruido del GPS en la orilla no genera entradas y salidas repetidas). */
export const MARGEN_SALIDA_GEOCERCA_M = 15;

const METROS_POR_GRADO = 111_320;

/**
 * Distancia aproximada (m) del punto a la orilla del anillo [lng, lat]:
 * proyección local equirectangular, suficiente para unos metros de margen.
 */
export function distanciaAlBordeMetros(
  lng: number,
  lat: number,
  ring: Array<[number, number]>,
): number {
  const kx = METROS_POR_GRADO * Math.cos((lat * Math.PI) / 180);
  const ky = METROS_POR_GRADO;
  let minima = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - lng) * kx;
    const ay = (ring[j][1] - lat) * ky;
    const bx = (ring[i][0] - lng) * kx;
    const by = (ring[i][1] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const largo = dx * dx + dy * dy;
    const t = largo > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo)) : 0;
    minima = Math.min(minima, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return minima;
}

/**
 * Dentro (entró), fuera (salió) o `null` si está fuera pero a menos del margen
 * de la orilla y se queda como estaba.
 */
export function dentroDeGeocerca(
  lng: number,
  lat: number,
  ring: Array<[number, number]>,
): boolean | null {
  if (pointInPolygonRing(lng, lat, ring)) return true;
  return distanciaAlBordeMetros(lng, lat, ring) > MARGEN_SALIDA_GEOCERCA_M ? false : null;
}

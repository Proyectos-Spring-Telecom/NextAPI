import haversine from 'haversine-distance';
import { Punto } from 'src/common/ApiResponse';

/** Distancia Haversine entre dos puntos → metros. */
export function distanciaMetros(p1: Punto, p2: Punto): number {
  return haversine(p1, p2);
}

/**
 * Suma Haversine entre puntos consecutivos.
 * Recorrido vacío o con un solo punto → 0.
 */
export function calcularDistanciaReal(recorrido: Punto[]): number {
  if (!recorrido?.length || recorrido.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < recorrido.length; i++) {
    total += distanciaMetros(recorrido[i - 1], recorrido[i]);
  }
  return total;
}

/**
 * Metros acumulados desde el inicio del recorrido hasta el índice indicado
 * (sin incluir tramos posteriores al índice).
 */
export function calcularDistanciaHastaIndex(
  recorrido: Punto[],
  index: number,
): number {
  if (!recorrido?.length || index <= 0) {
    return 0;
  }

  const limite = Math.min(index, recorrido.length - 1);
  let total = 0;
  for (let i = 1; i <= limite; i++) {
    total += distanciaMetros(recorrido[i - 1], recorrido[i]);
  }
  return total;
}

/** Distancia total del recorrido en kilómetros (2 decimales). */
export function calcularDistanciaKm(recorrido: Punto[]): number {
  const metros = calcularDistanciaReal(recorrido);
  return redondearKm(metros / 1000);
}

export function redondearKm(km: number): number {
  return Math.round(km * 100) / 100;
}

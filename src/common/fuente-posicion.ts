/**
 * Origen de la ubicación de una posición (`Posiciones.FuentePosicion`).
 * NULL = el equipo no lo informa (cámaras y AVL con GPS).
 * WIFI / ANTENA: ubicación aproximada de springGeoloc; su radio va en `RadioM`.
 * TELEFONO: ubicación de Android (fusionada o por red) que no se sabe si fue
 * GPS; su radio (precisión de Android) va en `RadioM` (springTrackPhone).
 */
export enum FuentePosicion {
  GPS = 0,
  WIFI = 1,
  ANTENA = 2,
  ULTIMA_VALIDA = 3,
  TELEFONO = 4,
}

const POR_NOMBRE: Record<string, FuentePosicion> = {
  gps: FuentePosicion.GPS,
  wifi: FuentePosicion.WIFI,
  antena: FuentePosicion.ANTENA,
  ultima_valida: FuentePosicion.ULTIMA_VALIDA,
  telefono: FuentePosicion.TELEFONO,
};

/** `positionSource` de los sockets de relojes ('gps', 'wifi', ...) → FuentePosicion. */
export function fuentePosicionDe(positionSource: unknown): FuentePosicion | null {
  return typeof positionSource === 'string'
    ? (POR_NOMBRE[positionSource] ?? null)
    : null;
}

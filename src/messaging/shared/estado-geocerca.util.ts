import { TIPOS_DISPOSITIVO_GEOCERCA } from '../../common/estatus.enum';

/** Fuera de geocerca (Sion Tabla 2 / prioridad 3). */
export const ESTADO_FUERA_GEOCERCA = 8;

/**
 * Estados de prioridad 1–2 (botón / energía).
 * Si ya vienen, no se pisan con geocerca.
 */
export const ESTADOS_PRIORIDAD_SOBRE_GEOCERCA: readonly number[] = [
  2, // alerta botón primario
  3, // alerta botón secundario
  10, // falta de energía
] as const;

export type DebeEvaluarGeocercaInput = {
  idTipoDispositivo?: number | null;
  idInstalacion?: number | null;
  estado?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export function debeEvaluarGeocerca(input: DebeEvaluarGeocercaInput): boolean {
  const tipo = Number(input.idTipoDispositivo);
  if (!Number.isFinite(tipo) || !TIPOS_DISPOSITIVO_GEOCERCA.includes(tipo)) {
    return false;
  }

  const idInst = Number(input.idInstalacion);
  if (!Number.isFinite(idInst) || idInst < 1) {
    return false;
  }

  if (
    input.estado != null &&
    ESTADOS_PRIORIDAD_SOBRE_GEOCERCA.includes(Number(input.estado))
  ) {
    return false;
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (lat === 0 && lng === 0) {
    return false;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false;
  }

  return true;
}

/**
 * True si el punto está **fuera de al menos una** geocerca (salida de zona).
 * Sin geometrías válidas → false (no asigna estado 8).
 */
export function estaFueraDeAlgunaGeocerca(
  lat: number,
  lng: number,
  geometrias: unknown[],
): boolean {
  let evaluadas = 0;
  for (const geo of geometrias) {
    const ring = extractOuterRing(geo);
    if (!ring || ring.length < 3) {
      continue;
    }
    evaluadas += 1;
    if (!pointInPolygonRing(lng, lat, ring)) {
      return true;
    }
  }
  return false;
}

/** Extrae anillo exterior [lng, lat][] desde Polygon / Feature / coords crudas. */
export function extractOuterRing(
  geo: unknown,
): Array<[number, number]> | null {
  if (geo == null) {
    return null;
  }

  if (Array.isArray(geo)) {
    if (geo.length >= 3 && Array.isArray(geo[0]) && typeof geo[0][0] === 'number') {
      return normalizeRing(geo as unknown[]);
    }
    return null;
  }

  if (typeof geo !== 'object') {
    return null;
  }

  const obj = geo as Record<string, unknown>;

  if (obj.type === 'Feature' && obj.geometry) {
    return extractOuterRing(obj.geometry);
  }

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const ring = extractOuterRing(f);
      if (ring) return ring;
    }
    return null;
  }

  if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
    const outer = obj.coordinates[0];
    return Array.isArray(outer) ? normalizeRing(outer) : null;
  }

  if (obj.type === 'MultiPolygon' && Array.isArray(obj.coordinates)) {
    const firstPoly = obj.coordinates[0];
    const outer = Array.isArray(firstPoly) ? firstPoly[0] : null;
    return Array.isArray(outer) ? normalizeRing(outer) : null;
  }

  if (Array.isArray(obj.coordinates)) {
    const outer = obj.coordinates[0];
    if (Array.isArray(outer) && Array.isArray(outer[0])) {
      return normalizeRing(outer);
    }
  }

  return null;
}

function normalizeRing(raw: unknown[]): Array<[number, number]> | null {
  const ring: Array<[number, number]> = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lng = Number(p[0]);
    const lat = Number(p[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

/** Ray casting; coords del anillo en [lng, lat] (GeoJSON). */
export function pointInPolygonRing(
  lng: number,
  lat: number,
  ring: Array<[number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

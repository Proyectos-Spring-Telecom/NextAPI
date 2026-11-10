import { TIPOS_DISPOSITIVO_TIEMPO_DETENIDO } from '../../common/estatus.enum';
import { distanciaMetros } from '../../utils/recorrido.utils';

/** Estados Sion por tiempo detenido (Tabla 2). */
export enum EnumEstadoTiempoDetenido {
  DETENIDO = 0,
  DETENIDO_30_MIN = 4,
  DETENIDO_60_MIN = 5,
  DETENIDO_90_MIN = 6,
}

/** Umbral de “en movimiento” alineado a Sion Tabla 10 (Velocidad > 5). */
export const VELOCIDAD_EN_MOVIMIENTO_MIN = 5;

export type AplicarTiempoDetenidoInput = {
  idTipoDispositivo?: number | null;
  estado?: number | null;
  velocidad?: number | null;
};

/**
 * Solo AVL/TRACKCAM/TRACKGAS, y solo si Estado=0 y Velocidad ≤ 5 (la regla
 * de movimiento es > 5: el GPS marca 1–5 km/h estando parado). Velocidad
 * null cuenta como 0. Cualquier otro estado (alertas prioritarias,
 * circulando, NULL) → no recalcular.
 */
export function debeAplicarTiempoDetenido(
  input: AplicarTiempoDetenidoInput,
): boolean {
  const tipo = Number(input.idTipoDispositivo);
  if (!Number.isFinite(tipo) || !TIPOS_DISPOSITIVO_TIEMPO_DETENIDO.includes(tipo)) {
    return false;
  }
  // null/undefined no son 0 (Number(null) === 0 en JS)
  if (input.estado == null || Number(input.estado) !== EnumEstadoTiempoDetenido.DETENIDO) {
    return false;
  }
  const vel = Number(input.velocidad ?? 0);
  return Number.isFinite(vel) && vel <= VELOCIDAD_EN_MOVIMIENTO_MIN;
}

/** Minutos detenidos → 0 | 4 | 5 | 6. */
export function estadoPorMinutosDetenido(
  minutos: number,
): EnumEstadoTiempoDetenido {
  if (!Number.isFinite(minutos) || minutos < 0) {
    return EnumEstadoTiempoDetenido.DETENIDO;
  }
  if (minutos >= 90) return EnumEstadoTiempoDetenido.DETENIDO_90_MIN;
  if (minutos >= 60) return EnumEstadoTiempoDetenido.DETENIDO_60_MIN;
  if (minutos >= 30) return EnumEstadoTiempoDetenido.DETENIDO_30_MIN;
  return EnumEstadoTiempoDetenido.DETENIDO;
}

/** Desplazamiento entre dos posiciones seguidas que cuenta como movimiento. */
export const DESPLAZAMIENTO_MOVIMIENTO_M = 200;

export type PuntoTramoDetenido = {
  fechaHora: Date | string;
  lat: number | null;
  lng: number | null;
};

/**
 * Desde cuándo se cuenta el tiempo detenido. `puntos` son las posiciones
 * posteriores al último movimiento con velocidad, en orden, y la última es
 * la actual.
 * - Llegar a más de 200 m de la posición anterior también es movimiento: el
 *   equipo reporta cada pocos minutos y puede no mandar ningún punto con
 *   velocidad en un traslado corto (6/11/2026, unidad 41: 800 m sin
 *   velocidad y salió "detenido más de 30 min" a los 5 min).
 * - La ignición no cuenta (10/11/2026, Monitoreo): una unidad estacionada
 *   con el motor apagado también pasa a 30/60/90 min. Antes, con la regla
 *   SION de motor encendido, LORD 021 se quedaba en gris horas.
 */
export function inicioConteoDetenido(
  puntos: PuntoTramoDetenido[],
): Date | string | null {
  if (puntos.length === 0) return null;

  let desde = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    if (
      a.lat != null &&
      a.lng != null &&
      b.lat != null &&
      b.lng != null &&
      distanciaMetros({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) >
        DESPLAZAMIENTO_MOVIMIENTO_M
    ) {
      desde = i;
    }
  }

  return puntos[desde].fechaHora;
}

export function minutosEntre(
  desde: Date | string,
  hasta: Date | string,
): number | null {
  const a = toDate(desde);
  const b = toDate(hasta);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 60_000;
}

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

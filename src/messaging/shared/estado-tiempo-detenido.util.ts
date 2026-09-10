import { TIPOS_DISPOSITIVO_TIEMPO_DETENIDO } from '../../common/estatus.enum';

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
 * Solo AVL/TRACKCAM/TRACKGAS, y solo si Estado=0 y Velocidad=0.
 * Cualquier otro estado (alertas prioritarias, circulando, NULL) → no recalcular.
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
  if (input.velocidad == null) {
    return false;
  }
  const vel = Number(input.velocidad);
  return Number.isFinite(vel) && vel === 0;
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

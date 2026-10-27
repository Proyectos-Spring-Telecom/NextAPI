/**
 * Helpers puros de la Galería de Consola (sin Nest / TypeORM, testeables).
 */

/** Rango máximo permitido por consulta (días). */
export const GALERIA_MAX_DIAS = 31;

/** Foto de una captura. `canal` 0 = `Posiciones.IdFoto`; 1..3 = `IdFoto1..3`. */
export type FotoGaleriaItem = {
  id: number;
  canal: number;
  url: string;
};

/**
 * Fotos de una fila de posición con los `Fotos` unidos como
 * `idFoto{n}` / `rutaFoto{n}` (n = 0..3). Omite slots sin foto o sin URL.
 */
export function extraerFotosPosicion(
  row: Record<string, unknown>,
): FotoGaleriaItem[] {
  const fotos: FotoGaleriaItem[] = [];
  for (let canal = 0; canal <= 3; canal++) {
    const id = Number(row[`idFoto${canal}`]);
    const url = row[`rutaFoto${canal}`];
    if (!Number.isFinite(id) || id <= 0) continue;
    if (typeof url !== 'string' || !url.trim()) continue;
    fotos.push({ id, canal, url: url.trim() });
  }
  return fotos;
}

/** `CatTipoDispositivo.Id` de TrackCam. */
const TIPO_DISPOSITIVO_TRACKCAM = 5;

/** Nombre de cada canal físico de una TrackCam (máximo 3). */
const ETIQUETAS_CANAL_TRACKCAM: Record<number, string> = {
  1: 'Vista Afuera',
  2: 'Vista Adentro',
  3: 'Cámara 3',
};

/** Canal resuelto de una foto para mostrar en la UI. */
export type CanalFotoResuelto = {
  /** Canal físico (1..3) o null si es la foto principal histórica (slot 0). */
  canalReal: number | null;
  etiquetaCanal: string;
};

/** Canales activos (1..3) de `TrackcamConfig` en una fila con `canal{n}Activo`. */
export function canalesActivosDesdeFila(row: Record<string, unknown>): number[] {
  return [1, 2, 3].filter((n) => Number(row[`canal${n}Activo`]) === 1);
}

/**
 * Etiqueta del canal de una foto. `slot` es la columna de `Posiciones`
 * (0 = `IdFoto`, 1..3 = `IdFoto1..3`), que **no** guarda el canal real:
 * - Slot 0: foto principal histórica (la ingesta actual no lo llena).
 * - TrackCam: el slot N es el N-ésimo canal activo (misma regla que Monitoreo);
 *   sin configuración de canales, se asume slot = canal.
 * - AVL / otros: "Cámara N" (sin suponer vista afuera/adentro).
 */
export function resolverCanalFoto(
  slot: number,
  idTipoDispositivo: number | null,
  canalesActivos: number[],
): CanalFotoResuelto {
  if (slot <= 0) {
    return { canalReal: null, etiquetaCanal: 'Foto Principal' };
  }
  if (idTipoDispositivo === TIPO_DISPOSITIVO_TRACKCAM) {
    const real = canalesActivos[slot - 1] ?? slot;
    return {
      canalReal: real,
      etiquetaCanal: ETIQUETAS_CANAL_TRACKCAM[real] ?? `Canal ${real}`,
    };
  }
  return { canalReal: slot, etiquetaCanal: `Cámara ${slot}` };
}

/** Nombre corto de la unidad para la UI: placa → económico → nombre de producto → IMEI. */
export function etiquetaInstalacion(inst: {
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  imei: string;
}): string {
  if (inst.placas) return inst.placas;
  if (inst.economico) return `Eco ${inst.economico}`;
  if (inst.descripcion) return inst.descripcion;
  return inst.imei;
}

/**
 * Valida un rango `YYYY-MM-DD HH:mm:ss` (hora de pared). Devuelve el mensaje
 * de error o `null` si es válido.
 */
export function validarRangoGaleria(
  fechaInicio: string,
  fechaFinal: string,
  maxDias = GALERIA_MAX_DIAS,
): string | null {
  if (fechaInicio > fechaFinal) {
    return 'fechaInicio no puede ser posterior a fechaFinal';
  }
  const ms = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  };
  const dias = (ms(fechaFinal) - ms(fechaInicio)) / 86_400_000;
  if (!Number.isFinite(dias)) {
    return 'fechaInicio / fechaFinal tienen un formato inválido';
  }
  if (dias > maxDias) {
    return `El rango máximo de consulta es de ${maxDias} días`;
  }
  return null;
}

/**
 * Normaliza el texto del buscador de unidades. Solo dígitos (sin espacios/guiones)
 * → búsqueda dentro del IMEI; si trae letras → placa / económico / nombre de producto.
 */
export function normalizarBusquedaGaleria(
  q: string,
): { tipo: 'imei' | 'texto'; valor: string } {
  const limpio = String(q ?? '').trim().replace(/\s+/g, ' ');
  const soloDigitos = limpio.replace(/[\s-]/g, '');
  if (/^\d+$/.test(soloDigitos)) {
    return { tipo: 'imei', valor: soloDigitos };
  }
  return { tipo: 'texto', valor: limpio };
}

/** Escapa `%`, `_` y `\` para usar el texto dentro de un `LIKE`. */
export function escaparLike(valor: string): string {
  return valor.replace(/[\%_\\]/g, (c) => `\\${c}`);
}

/**
 * Rango por defecto de la galería por IMEI: día 1 del mes de `hoy` a las
 * 00:00:00 hasta `hoy` a las 23:59:59 (hora de pared del calendario local).
 */
export function rangoPorDefectoMesActual(hoy: Date): {
  fechaInicio: string;
  fechaFinal: string;
} {
  const y = hoy.getFullYear();
  const m = hoy.getMonth() + 1;
  const d = hoy.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    fechaInicio: `${y}-${pad(m)}-01 00:00:00`,
    fechaFinal: `${y}-${pad(m)}-${pad(d)} 23:59:59`,
  };
}

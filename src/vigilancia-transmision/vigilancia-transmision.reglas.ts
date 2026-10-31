/** Reglas puras de la vigilancia de transmisión (docs/motor-activos.md §7b). */

/** Horas sin transmitir de un tipo de equipo sin fila en VigilanciaTransmisionTipo. */
export const HORAS_SIN_TRANSMITIR_DEFECTO = 12;

/** Ventana diaria de evaluación, hora de México: [9:00, 11:00). */
export const VENTANA_EVALUACION = { desdeHora: 9, hastaHora: 11 } as const;

/** Avisos de una misma compañía en una evaluación para marcar posible falla del proveedor. */
export const PROVEEDOR_MIN_DEFECTO = 3;

export const ESTATUS_AVISO = ['abierto', 'atendido', 'cerrado'] as const;
export type EstatusAviso = (typeof ESTATUS_AVISO)[number];

/** Estatus en los que el aviso sigue vivo (uno por instalación). */
export const ESTATUS_AVISO_VIVO: readonly EstatusAviso[] = ['abierto', 'atendido'];

export const RESULTADOS_AVISO = ['falla_equipo', 'taller', 'proveedor', 'cliente_avisado', 'otro'] as const;
export type ResultadoAviso = (typeof RESULTADOS_AVISO)[number];

/** transmitio: volvió a transmitir; baja: la instalación ya no está activa; cambio: la versión se reemplazó. */
export type MotivoCierreAviso = 'transmitio' | 'baja' | 'cambio';

/** Umbral en horas para un tipo de equipo. */
export function umbralHoras(idTipoDispositivo: number, porTipo: ReadonlyMap<number, number>): number {
  return porTipo.get(Number(idTipoDispositivo)) ?? HORAS_SIN_TRANSMITIR_DEFECTO;
}

/** Horas completas entre la última transmisión y ahora (ambas en hora de pared). */
export function horasSinTransmitir(ultima: Date, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - ultima.getTime()) / 3_600_000));
}

/** `ahora` en hora de pared (convención nowMexicoCityAsUtcDate): ¿dentro de 9:00–11:00? */
export function dentroDeVentana(ahora: Date): boolean {
  const hora = ahora.getUTCHours();
  return hora >= VENTANA_EVALUACION.desdeHora && hora < VENTANA_EVALUACION.hastaHora;
}

/** Día de la evaluación, `YYYY-MM-DD`, desde una fecha en hora de pared. */
export function diaDe(ahora: Date): string {
  return ahora.toISOString().slice(0, 10);
}

export interface ResumenProveedor {
  fechaEvaluacion: string;
  idTelefonia: number | null;
  telefonia: string | null;
  avisos: number;
  posibleFallaProveedor: boolean;
}

/**
 * Agrupa los avisos por evaluación y compañía telefónica. Varias SIM de la
 * misma compañía sin transmitir en la misma evaluación → posible falla del
 * proveedor. Sin compañía (sin SIM) no se agrupa como proveedor.
 */
export function agruparPorProveedor(
  avisos: ReadonlyArray<{ fechaEvaluacion: string; idTelefonia: number | null; telefonia: string | null }>,
  minimo: number,
): ResumenProveedor[] {
  const grupos = new Map<string, ResumenProveedor>();
  for (const a of avisos) {
    const clave = `${a.fechaEvaluacion}|${a.idTelefonia ?? ''}`;
    const g = grupos.get(clave);
    if (g) g.avisos += 1;
    else grupos.set(clave, { fechaEvaluacion: a.fechaEvaluacion, idTelefonia: a.idTelefonia, telefonia: a.telefonia, avisos: 1, posibleFallaProveedor: false });
  }
  const salida = [...grupos.values()];
  for (const g of salida) g.posibleFallaProveedor = g.idTelefonia != null && g.avisos >= minimo;
  return salida.sort((x, y) => y.fechaEvaluacion.localeCompare(x.fechaEvaluacion) || y.avisos - x.avisos);
}

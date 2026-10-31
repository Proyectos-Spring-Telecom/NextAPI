/**
 * Tramos de vigencia (docs/motor-activos.md §6): cada versión de una
 * instalación aporta `(IMEI, desde, hasta)`. Las posiciones se leen por IMEI
 * recortadas a esos tramos: un cliente no ve lo que el equipo transmitió antes
 * o después de estar instalado con él. Funciones puras; la carga está en
 * TramosInstalacionService.
 */

/**
 * Fechas en hora de pared de México, `YYYY-MM-DD HH:mm:ss`. `hasta` null =
 * vigente. Intervalo semiabierto `[desde, hasta)`: en el segundo del cambio la
 * posición es de la versión que empieza, nunca de las dos.
 */
export interface TramoInstalacion {
  idInstalacion: number;
  idDispositivo: number;
  idProducto: number | null;
  imei: string;
  desde: string;
  hasta: string | null;
}

/** Tramo recortado a un periodo: siempre cerrado. */
export interface TramoEnPeriodo extends TramoInstalacion {
  hasta: string;
  /** `hasta` es el fin de la vigencia (excluido); si es el fin del periodo pedido, se incluye. */
  hastaExclusivo: boolean;
  /** Vigencia original del tramo (antes del recorte), para la posición anterior y la UI. */
  vigenteDesde: string;
  vigenteHasta: string | null;
}

/**
 * Une tramos consecutivos o encimados del mismo IMEI y producto (p. ej. un
 * cambio de SIM abre una versión nueva con el mismo equipo). Ordena por `desde`.
 */
export function fusionarTramos<T extends TramoInstalacion>(tramos: T[]): T[] {
  const ordenados = [...tramos].sort(
    (a, b) => a.desde.localeCompare(b.desde) || a.imei.localeCompare(b.imei),
  );
  const resultado: T[] = [];
  for (const t of ordenados) {
    // Mismo equipo y mismo producto: un cambio de vehículo deja dos tramos (cada uno con su etiqueta).
    const previo = [...resultado].reverse().find((r) => r.imei === t.imei && r.idProducto === t.idProducto);
    if (previo && (previo.hasta == null || t.desde <= previo.hasta)) {
      if (previo.hasta != null && (t.hasta == null || t.hasta > previo.hasta)) {
        previo.hasta = t.hasta;
      }
      continue;
    }
    resultado.push({ ...t });
  }
  return resultado;
}

/** Intersección de los tramos con `[inicio, fin]`; descarta los que quedan vacíos. */
export function recortarTramos(
  tramos: readonly TramoInstalacion[],
  inicio: string,
  fin: string,
): TramoEnPeriodo[] {
  const salida: TramoEnPeriodo[] = [];
  for (const t of tramos) {
    const desde = t.desde > inicio ? t.desde : inicio;
    const cierraVigencia = t.hasta != null && t.hasta <= fin;
    const hasta = cierraVigencia ? t.hasta! : fin;
    if (cierraVigencia ? desde >= hasta : desde > hasta) continue;
    salida.push({ ...t, desde, hasta, hastaExclusivo: cierraVigencia, vigenteDesde: t.desde, vigenteHasta: t.hasta });
  }
  return salida;
}

/** ¿La posición `(imei, fechaHora)` cae en algún tramo? */
export function posicionEnTramos(
  tramos: readonly TramoInstalacion[],
  imei: string,
  fechaHora: string,
): boolean {
  return tramos.some(
    (t) => t.imei === imei && fechaHora >= t.desde && (t.hasta == null || fechaHora < t.hasta),
  );
}

/** Comparador del fin del tramo en SQL: `<` si es el fin de la vigencia, `<=` si es el del periodo. */
export function operadorHasta(t: Pick<TramoEnPeriodo, 'hastaExclusivo'>): '<' | '<=' {
  return t.hastaExclusivo ? '<' : '<=';
}

/** ¿`fechaHora` cae en el tramo recortado? Mismo criterio que la condición SQL. */
export function enTramoRecortado(t: TramoEnPeriodo, fechaHora: string): boolean {
  return fechaHora >= t.desde && (t.hastaExclusivo ? fechaHora < t.hasta : fechaHora <= t.hasta);
}

/**
 * Condición SQL sobre `Posiciones` (o una tabla con `imei` y `fechaHora`) para
 * los tramos ya recortados. Sin CAST, para usar el índice `(Imei, FechaHora)`.
 * Sin tramos → `1 = 0`.
 */
export function condicionTramos(
  alias: string,
  tramos: readonly TramoEnPeriodo[],
  prefijo = 'tr',
): { sql: string; params: Record<string, string> } {
  if (!tramos.length) return { sql: '1 = 0', params: {} };
  const params: Record<string, string> = {};
  const partes = tramos.map((t, i) => {
    params[`${prefijo}${i}i`] = t.imei;
    params[`${prefijo}${i}d`] = t.desde;
    params[`${prefijo}${i}h`] = t.hasta;
    return `(${alias}.imei = :${prefijo}${i}i AND ${alias}.fechaHora >= :${prefijo}${i}d AND ${alias}.fechaHora ${operadorHasta(t)} :${prefijo}${i}h)`;
  });
  return { sql: `(${partes.join(' OR ')})`, params };
}

/**
 * Variante de condicionTramos para SQL crudo (`dataSource.query`): parámetros
 * posicionales `?` y columnas de la tabla (`Imei`, `FechaHora`).
 */
export function condicionTramosPosicional(
  alias: string,
  tramos: readonly TramoEnPeriodo[],
): { sql: string; params: string[] } {
  if (!tramos.length) return { sql: '1 = 0', params: [] };
  const params: string[] = [];
  const partes = tramos.map((t) => {
    params.push(t.imei, t.desde, t.hasta);
    return `(${alias}.Imei = ? AND ${alias}.FechaHora >= ? AND ${alias}.FechaHora ${operadorHasta(t)} ?)`;
  });
  return { sql: `(${partes.join(' OR ')})`, params };
}

/**
 * `CASE` que devuelve la instalación dueña de cada posición según los tramos
 * (mismo IMEI puede estar en dos instalaciones del cliente en fechas
 * distintas). Usa los mismos nombres de parámetro que condicionTramos con el
 * mismo `prefijo`, así que se combinan en una consulta. Sin tramos → `NULL`.
 */
export function instalacionPorTramos(
  alias: string,
  tramos: readonly TramoEnPeriodo[],
  prefijo = 'tr',
): { sql: string; params: Record<string, string> } {
  if (!tramos.length) return { sql: 'NULL', params: {} };
  const { params } = condicionTramos(alias, tramos, prefijo);
  const casos = tramos.map(
    (t, i) =>
      `WHEN ${alias}.imei = :${prefijo}${i}i AND ${alias}.fechaHora >= :${prefijo}${i}d AND ${alias}.fechaHora ${operadorHasta(t)} :${prefijo}${i}h ` +
      `THEN ${Number(t.idInstalacion)}`,
  );
  return { sql: `(CASE ${casos.join(' ')} END)`, params };
}

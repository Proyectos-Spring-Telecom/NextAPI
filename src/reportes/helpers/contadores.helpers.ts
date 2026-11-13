/**
 * Odómetro y horas de motor acumulados (docs/fis-fiber, ruta del back §3.4 y
 * §3.5): la base (lectura capturada o el alta del vehículo) más lo calculado
 * por día en `ResumenDiarioUnidad` desde el día siguiente a la base.
 */
export type FuenteBase = 'captura' | 'alta_vehiculo' | 'sin_base';

export type BaseContador = {
  valor: number;
  /** `YYYY-MM-DD HH:mm:ss`; null sin base. */
  fecha: string | null;
  fuente: FuenteBase;
};

export type ValorDia = { fecha: string; valor: number };

/** Suma por día (varias instalaciones el mismo día, p. ej. un cambio de equipo). */
export function sumarPorDia(filas: readonly ValorDia[]): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const f of filas) porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.valor);
  return porDia;
}

/** Días que cuentan para la base: los posteriores al día en que se tomó. */
export function cuentaParaBase(base: BaseContador, fecha: string): boolean {
  return base.fecha == null || fecha > base.fecha.slice(0, 10);
}

export type ValorAlCierre = { fecha: string; valor: number; alCierre: number };

/**
 * Serie por día con el acumulado al cierre. `previos` es lo acumulado desde la
 * base hasta el día anterior a `dias[0]`.
 */
export function serieAlCierre(
  base: BaseContador,
  previos: number,
  dias: readonly string[],
  porDia: ReadonlyMap<string, number>,
): ValorAlCierre[] {
  let acumulado = base.valor + previos;
  return dias.map((fecha) => {
    const valor = porDia.get(fecha) ?? 0;
    if (cuentaParaBase(base, fecha)) acumulado += valor;
    return { fecha, valor: redondear(valor), alCierre: redondear(acumulado) };
  });
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Primer día con resumen guardado frente al día siguiente a la base: si el
 * histórico empieza después, el acumulado se queda corto.
 */
export function historialCompleto(
  base: BaseContador,
  primerDia: string | null,
  hoy: string,
): boolean {
  if (base.fecha == null) return false;
  const desde = base.fecha.slice(0, 10);
  if (siguienteDia(desde) >= hoy) return true;
  return primerDia != null && primerDia <= siguienteDia(desde);
}

export function siguienteDia(dia: string): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

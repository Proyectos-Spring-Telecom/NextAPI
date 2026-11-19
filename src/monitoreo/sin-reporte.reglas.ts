/**
 * Reglas puras de "unidad sin reporte" (docs/front-next.md §33).
 *
 * Cuánto silencio es anormal depende del equipo:
 * - Vehículo y activo: con la última posición encendida, en movimiento o en
 *   alerta, `vehiculoMin` (11). Apagada o detenida sin ignición: `apagadoMin`
 *   (0 = no aplica: con el motor apagado los equipos reportan cada 2 h; esa
 *   falta la cubre la vigilancia diaria de transmisión).
 * - Reloj: el doble de su `IntervaloReporteSegundos`, mínimo `relojMin`.
 * - Teléfono: `telefonoMin` (30). Quieto, la app no manda la coordenada
 *   repetida y sus latidos sin posición no llegan a Next.
 * - Inmueble (paneles) y persona con otro equipo: no aplica.
 */

import { EnumTipoDispositivo, EnumTipoProducto } from 'src/common/estatus.enum';

export interface UmbralesSinReporte {
  vehiculoMin: number;
  apagadoMin: number;
  activoMin: number;
  relojMin: number;
  telefonoMin: number;
}

export const UMBRALES_DEFECTO: UmbralesSinReporte = {
  vehiculoMin: 11,
  apagadoMin: 0,
  activoMin: 11,
  relojMin: 11,
  telefonoMin: 30,
};

/** Estados de una unidad "despierta": movimiento (1), exceso (7) y alertas (2, 3, 8, 9, 10, 11). */
const ESTADOS_ACTIVOS: ReadonlySet<number> = new Set([1, 2, 3, 7, 8, 9, 10, 11]);
/** km/h: por encima, en movimiento aunque el Estado diga otra cosa. */
const VELOCIDAD_MOVIMIENTO = 5;

export interface UltimoReporte {
  idTipoProducto: number;
  idTipoDispositivo: number | null;
  ignicion: number | null;
  estado: number | null;
  velocidad: number | null;
  intervaloRelojSeg: number | null;
}

/** La última posición dice que la unidad debería seguir reportando seguido. */
export function encendida(u: Pick<UltimoReporte, 'ignicion' | 'estado' | 'velocidad'>): boolean {
  return (
    Number(u.ignicion) === 1 ||
    (u.estado != null && ESTADOS_ACTIVOS.has(Number(u.estado))) ||
    Number(u.velocidad ?? 0) >= VELOCIDAD_MOVIMIENTO
  );
}

/** Minutos sin reporte para entrar en falta; 0 = no aplica a esta unidad. */
export function umbralMinutos(u: UltimoReporte, c: UmbralesSinReporte = UMBRALES_DEFECTO): number {
  const tipo = Number(u.idTipoProducto);
  if (tipo === EnumTipoProducto.VEHICULO || tipo === EnumTipoProducto.ACTIVO) {
    if (!encendida(u)) return positivo(c.apagadoMin);
    return positivo(tipo === EnumTipoProducto.VEHICULO ? c.vehiculoMin : c.activoMin);
  }
  if (tipo === EnumTipoProducto.PERSONA) {
    const disp = Number(u.idTipoDispositivo);
    if (disp === EnumTipoDispositivo.RELOJ) {
      if (!(c.relojMin > 0)) return 0;
      const doble = Number(u.intervaloRelojSeg) > 0 ? Math.ceil((2 * Number(u.intervaloRelojSeg)) / 60) : 0;
      return Math.max(c.relojMin, doble);
    }
    if (disp === EnumTipoDispositivo.TELEFONO) return positivo(c.telefonoMin);
  }
  return 0;
}

function positivo(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export type DecisionEpisodio = 'avisar' | 'registrar';

/**
 * Una unidad que acaba de cruzar su umbral se avisa. Una que ya llevaba mucho
 * más (al desplegar, o tras un reinicio largo) solo se registra: la marca sale
 * en el mapa sin alerta roja, para no soltar cientos de avisos viejos de golpe.
 */
export function decidir(minutosSinReporte: number, umbral: number, margenAvisoMin: number): DecisionEpisodio {
  return minutosSinReporte <= umbral + Math.max(0, margenAvisoMin) ? 'avisar' : 'registrar';
}

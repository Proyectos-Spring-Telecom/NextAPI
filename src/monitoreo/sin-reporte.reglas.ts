/**
 * Reglas puras de "unidad sin reporte" (docs/front-next.md §33).
 *
 * Cuánto silencio es anormal depende del equipo:
 * - Vehículo y activo "en marcha" en su última posición: `vehiculoMin` (11).
 *   En marcha = en alerta (2, 3, 8, 9, 10, 11), a `velocidadKmh` (20) o más, o
 *   con ignición encendida en TrackCam o TrackGas. En los AVL la ignición no
 *   sirve: varios no reportan el apagado y se quedan detenidos con
 *   `Ignicion = 1` (LORD 109, Kangoo, Urvan… 18/11/2026); la última posición a
 *   6–12 km/h es la maniobra de estacionarse. Lo demás: `apagadoMin` (0 = no
 *   aplica: apagados reportan cada 2 h; lo cubre la vigilancia diaria).
 * - Reloj: el doble de su `IntervaloReporteSegundos`, mínimo `relojMin`.
 * - Teléfono: `telefonoMin` (30). Quieto, la app no manda la coordenada
 *   repetida y sus latidos sin posición no llegan a Next.
 * - Inmueble (paneles) y persona con otro equipo: no aplica.
 */

import { EnumTipoDispositivo, EnumTipoProducto } from 'src/common/estatus.enum';

export interface UmbralesSinReporte {
  vehiculoMin: number;
  apagadoMin: number;
  /** km/h desde los que la última posición cuenta como en marcha. */
  velocidadKmh: number;
  activoMin: number;
  relojMin: number;
  telefonoMin: number;
}

export const UMBRALES_DEFECTO: UmbralesSinReporte = {
  vehiculoMin: 11,
  apagadoMin: 0,
  velocidadKmh: 20,
  activoMin: 11,
  relojMin: 11,
  telefonoMin: 30,
};

/** Estados de alerta: la unidad en alerta que se calla siempre cuenta (corte de energía, pánico). */
const ESTADOS_ALERTA: ReadonlySet<number> = new Set([2, 3, 8, 9, 10, 11]);
/** Equipos cuya ignición es confiable (ACC del propio equipo). */
export const IGNICION_CONFIABLE: ReadonlySet<number> = new Set([EnumTipoDispositivo.TRACKCAM, EnumTipoDispositivo.TRACKGAS]);

export interface UltimoReporte {
  idTipoProducto: number;
  idTipoDispositivo: number | null;
  ignicion: number | null;
  estado: number | null;
  velocidad: number | null;
  intervaloRelojSeg: number | null;
}

/** La última posición dice que la unidad iba en marcha (y debería seguir reportando seguido). */
export function enMarcha(
  u: Pick<UltimoReporte, 'idTipoDispositivo' | 'ignicion' | 'estado' | 'velocidad'>,
  velocidadKmh: number = UMBRALES_DEFECTO.velocidadKmh,
): boolean {
  return (
    (u.estado != null && ESTADOS_ALERTA.has(Number(u.estado))) ||
    Number(u.velocidad ?? 0) >= velocidadKmh ||
    (Number(u.ignicion) === 1 && IGNICION_CONFIABLE.has(Number(u.idTipoDispositivo)))
  );
}

/** Minutos sin reporte para entrar en falta; 0 = no aplica a esta unidad. */
export function umbralMinutos(u: UltimoReporte, c: UmbralesSinReporte = UMBRALES_DEFECTO): number {
  const tipo = Number(u.idTipoProducto);
  if (tipo === EnumTipoProducto.VEHICULO || tipo === EnumTipoProducto.ACTIVO) {
    if (!enMarcha(u, c.velocidadKmh)) return positivo(c.apagadoMin);
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

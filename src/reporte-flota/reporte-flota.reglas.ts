/**
 * Reglas puras del reporte de flota (docs/front-next.md §34).
 *
 * Reemplaza la vista legacy "Monitoreo — Reporte de Vehículos" (Sion): cuántas
 * unidades hay, cuáles van en movimiento y, por unidad, el texto listo para
 * mandar por WhatsApp con su dirección y la liga al mapa.
 *
 * En movimiento = la última posición llegó hace poco (`vigenciaMin`) y trae
 * `velocidadKmh` o más. La ignición no cuenta: varios AVL se quedan con
 * `Ignicion = 1` estacionados (ver `sin-reporte.reglas.ts`); el legacy los
 * contaba como "en ruta".
 */

import { IGNICION_CONFIABLE } from 'src/monitoreo/sin-reporte.reglas';

export type SituacionUnidad = 'movimiento' | 'detenida' | 'sinReporte' | 'sinPosicion';

export const SITUACIONES: readonly SituacionUnidad[] = ['movimiento', 'detenida', 'sinReporte', 'sinPosicion'];

export interface CriterioMovimiento {
  /** km/h desde los que la unidad va en movimiento. */
  velocidadKmh: number;
  /** Minutos que vale la última posición para decir que sigue en movimiento. */
  vigenciaMin: number;
}

export const CRITERIO_DEFECTO: CriterioMovimiento = { velocidadKmh: 5, vigenciaMin: 15 };

export interface UnidadParaClasificar {
  lat: number | null;
  lng: number | null;
  fechaHora: string | null;
  fhRegistro: string | null;
  velocidad: number | null;
  sinReporteDesde: string | null;
}

/**
 * Las fechas de la base son hora de pared de México marcada como UTC
 * (`DB_TZ=-00:00`): `ahoraPared` va en la misma convención
 * (`nowMexicoCityAsUtcDate()`), no `new Date()`.
 */
export function clasificar(u: UnidadParaClasificar, ahoraPared: Date, c: CriterioMovimiento = CRITERIO_DEFECTO): SituacionUnidad {
  if (u.fechaHora == null || u.lat == null || u.lng == null) return 'sinPosicion';
  if (u.sinReporteDesde != null) return 'sinReporte';
  const llegada = new Date(u.fhRegistro ?? u.fechaHora).getTime();
  const reciente = Number.isFinite(llegada) && ahoraPared.getTime() - llegada <= c.vigenciaMin * 60_000;
  return reciente && Number(u.velocidad ?? 0) >= c.velocidadKmh ? 'movimiento' : 'detenida';
}

export function ignicionConfiable(idTipoDispositivo: number | null): boolean {
  return IGNICION_CONFIABLE.has(Number(idTipoDispositivo));
}

export function urlMapa(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

const TZ = 'America/Mexico_City';

/** HH:mm de una fecha de la base (hora de pared marcada como UTC). */
export function horaDePared(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Fecha y hora de México de un instante real (`new Date()`). */
export function fechaHoraLocal(iso: string | Date): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export interface DatosMensaje {
  economico: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  situacion: SituacionUnidad;
  velocidad: number | null;
  ignicion: number | null;
  idTipoDispositivo: number | null;
  lat: number | null;
  lng: number | null;
  fechaHora: string | null;
  direccion: string | null;
}

/** Texto para WhatsApp (negritas con `*`), mismo formato que el legacy. `generadoEn` = instante real. */
export function armarMensaje(d: DatosMensaje, generadoEn: Date): string {
  const unidad = `Unidad ${d.economico ?? d.placa ?? 's/n'}`;
  const verbo = d.situacion === 'movimiento' ? 'circulando sobre' : 'ubicada en';
  const titulo = d.direccion
    ? `${unidad} ${verbo} ${d.direccion}`
    : d.lat != null && d.lng != null
      ? `${unidad} — última posición: ${d.lat}, ${d.lng}`
      : `${unidad} — sin posición`;

  const vehiculo = [d.marca, d.modelo, d.anio].filter((x) => x != null && x !== '').join(' ');
  const lineas = [`*${titulo}*`, ''];
  lineas.push([d.placa ? `Placas: ${d.placa}` : null, vehiculo || null].filter(Boolean).join(' | '));
  if (d.fechaHora) lineas.push(`Última posición: ${horaDePared(d.fechaHora)}`);
  const vel = `Vel: ${Math.round(Number(d.velocidad ?? 0))} km/h`;
  lineas.push(
    ignicionConfiable(d.idTipoDispositivo) && d.ignicion != null
      ? `Ignición: ${Number(d.ignicion) === 1 ? 'ON' : 'OFF'} | ${vel}`
      : vel,
  );
  if (d.lat != null && d.lng != null) lineas.push(urlMapa(d.lat, d.lng));
  lineas.push('', `Reporte generado: ${fechaHoraLocal(generadoEn)}`);
  return lineas.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

/** Dirección legible a partir del `address` de Nominatim (calle, colonia, ciudad, estado, CP). */
export function direccionDeNominatim(address: Record<string, string> | undefined | null): string | null {
  if (!address) return null;
  const a = address;
  const partes = [
    a.road || a.pedestrian || a.path || '',
    a.suburb || a.neighbourhood || a.quarter || '',
    a.city || a.town || a.village || a.municipality || '',
    a.state || '',
    a.postcode || '',
  ].filter(Boolean);
  return partes.length ? `${partes.join(', ')}, México` : null;
}

/** Llave de caché: ~11 m (4 decimales). */
export function claveCoordenada(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

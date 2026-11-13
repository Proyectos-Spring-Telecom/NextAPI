import { distanciaMetros } from 'src/utils/recorrido.utils';
import { margenSalidaMetros } from 'src/messaging/shared/puntos-interes-avisos.service';
import {
  fechaDeMs,
  msDeFecha,
  type PuntoOperacion,
} from 'src/reportes/helpers/jornada.helpers';

/**
 * Cumplimiento de un trabajo de despacho con las posiciones de la unidad
 * (docs/fis-fiber, ruta del back §3.9). Llega al entrar al radio del punto;
 * sale al alejarse más del radio + margen (mismo criterio que los avisos de
 * puntos de interés). Cada parada toma su primera visita dentro del trabajo.
 */
export type ParadaPlan = {
  orden: number;
  idPuntoInteres: number;
  nombre: string;
  lat: number;
  lng: number;
  radioMetros: number;
  /** Hora de México `YYYY-MM-DD HH:mm:ss`. */
  ventanaDesde: string | null;
  ventanaHasta: string | null;
};

export type EstadoParada =
  | 'pendiente'
  | 'en_sitio'
  | 'a_tiempo'
  | 'tarde'
  | 'antes'
  | 'visitada'
  | 'no_visitada';

export type ParadaCumplimiento = ParadaPlan & {
  llegada: string | null;
  salida: string | null;
  minutosEnSitio: number | null;
  estado: EstadoParada;
};

export type EstadoTrabajo =
  | 'programado'
  | 'en_curso'
  | 'completado'
  | 'incompleto'
  | 'cancelado';

export type ResumenCumplimiento = {
  estado: EstadoTrabajo;
  paradas: number;
  visitadas: number;
  aTiempo: number;
  tarde: number;
  noVisitadas: number;
  /** Las visitas siguieron el orden planeado. */
  enOrden: boolean;
};

export function evaluarParada(
  p: ParadaPlan,
  puntos: readonly PuntoOperacion[],
  inicio: string,
  fin: string,
  ahoraMs: number,
): ParadaCumplimiento {
  const iniMs = msDeFecha(inicio.replace(' ', 'T'));
  const finMs = msDeFecha(fin.replace(' ', 'T'));
  const salidaM = p.radioMetros + margenSalidaMetros(p.radioMetros);
  let llegadaMs: number | null = null;
  let salidaMs: number | null = null;
  for (const pt of puntos) {
    if (pt.lat == null || pt.lng == null) continue;
    const ms = msDeFecha(pt.fechaHora);
    if (ms < iniMs || ms > finMs) continue;
    const d = distanciaMetros({ lat: pt.lat, lng: pt.lng }, { lat: p.lat, lng: p.lng });
    if (llegadaMs == null) {
      if (d <= p.radioMetros) llegadaMs = ms;
    } else if (d > salidaM) {
      salidaMs = ms;
      break;
    }
  }
  const llegada = llegadaMs != null ? fechaDeMs(llegadaMs) : null;
  const salida = salidaMs != null ? fechaDeMs(salidaMs) : null;
  const minutosEnSitio =
    llegadaMs != null && salidaMs != null
      ? Math.round(((salidaMs - llegadaMs) / 60_000) * 10) / 10
      : null;

  const desdeMs = p.ventanaDesde ? msDeFecha(p.ventanaDesde.replace(' ', 'T')) : null;
  const hastaMs = p.ventanaHasta ? msDeFecha(p.ventanaHasta.replace(' ', 'T')) : null;
  let estado: EstadoParada;
  if (llegadaMs == null) {
    const limite = hastaMs ?? finMs;
    estado = ahoraMs > limite ? 'no_visitada' : 'pendiente';
  } else if (salidaMs == null && ahoraMs <= finMs) {
    estado = 'en_sitio';
  } else if (desdeMs != null && llegadaMs < desdeMs) {
    estado = 'antes';
  } else if (hastaMs != null && llegadaMs > hastaMs) {
    estado = 'tarde';
  } else if (desdeMs != null || hastaMs != null) {
    estado = 'a_tiempo';
  } else {
    estado = 'visitada';
  }
  return { ...p, llegada, salida, minutosEnSitio, estado };
}

export function resumir(
  paradas: readonly ParadaCumplimiento[],
  inicio: string,
  fin: string,
  ahoraMs: number,
  cancelado: boolean,
): ResumenCumplimiento {
  const visitadas = paradas.filter((p) => p.llegada != null);
  const ordenLlegadas = [...visitadas].sort((a, b) =>
    (a.llegada as string).localeCompare(b.llegada as string),
  );
  const enOrden = ordenLlegadas.every(
    (p, i) => i === 0 || p.orden > ordenLlegadas[i - 1].orden,
  );
  const noVisitadas = paradas.filter((p) => p.estado === 'no_visitada').length;
  let estado: EstadoTrabajo;
  if (cancelado) estado = 'cancelado';
  else if (
    paradas.length > 0 &&
    visitadas.length === paradas.length &&
    paradas.every((p) => p.estado !== 'en_sitio')
  )
    estado = 'completado';
  else if (ahoraMs > msDeFecha(fin.replace(' ', 'T'))) estado = 'incompleto';
  else if (visitadas.length > 0 || ahoraMs >= msDeFecha(inicio.replace(' ', 'T')))
    estado = 'en_curso';
  else estado = 'programado';
  return {
    estado,
    paradas: paradas.length,
    visitadas: visitadas.length,
    aTiempo: paradas.filter((p) => p.estado === 'a_tiempo').length,
    tarde: paradas.filter((p) => p.estado === 'tarde').length,
    noVisitadas,
    enOrden,
  };
}

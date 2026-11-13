import { TipoOrigenIncidente } from 'src/common/estatus.enum';
import { Incidentes } from 'src/entities/Incidentes';
import { etiquetaEstadoPosicion } from './incidentes-alerta.util';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import {
  nombreCliente,
  nombreUsuario,
} from 'src/productos/map-relaciones.util';

export const RELACIONES_INCIDENTE_LISTA = [
  'idCliente2',
  'idUsuario2',
] as const;

export const RELACIONES_INCIDENTE_DETALLE = [
  'idCliente2',
  'idUsuario2',
  'seguimientoIncidentes',
  'seguimientoIncidentes.idUsuario2',
] as const;

export function mapSeguimientoPlano(item: SeguimientoIncidentes) {
  return {
    id: Number(item.id),
    idIncidente: Number(item.idIncidente),
    idUsuario: item.idUsuario != null ? Number(item.idUsuario) : null,
    nombreUsuario: nombreUsuario(item.idUsuario2) ?? item.idUsuario2?.userName ?? null,
    fechaHora: item.fechaHora,
    actividad: item.actividad,
    medio: item.medio,
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
  };
}

/**
 * Datos de la unidad para el grid / PDF de Consola: la instalación activa del
 * IMEI (posición) o del panel (`idPanel`, evento de alarma). En un panel,
 * `nombreProducto` es el inmueble y `lat`/`lng` son las del inmueble.
 */
export type UnidadIncidente = {
  idInstalacion: number | null;
  economico: string | null;
  placas: string | null;
  marca: string | null;
  modelo: string | null;
  nombreProducto: string | null;
  inmueble?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function datoOrigen(item: Incidentes, key: string): unknown {
  const origen = item.datosOrigen;
  return origen && typeof origen === 'object' ? origen[key] : undefined;
}

/** IMEI del snapshot (solo incidentes de posición). */
export function imeiIncidente(item: Incidentes): string | null {
  if (Number(item.tipoOrigen) !== TipoOrigenIncidente.POSICION) return null;
  const raw = datoOrigen(item, 'imei');
  const imei = raw == null ? '' : String(raw).trim();
  return imei || null;
}

/** Panel del snapshot (solo incidentes de evento de alarma). */
export function idPanelIncidente(item: Incidentes): number | null {
  if (Number(item.tipoOrigen) !== TipoOrigenIncidente.EVENTO_ALARMA) return null;
  const n = Number(datoOrigen(item, 'idPanel'));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Número o null (las coordenadas en null no se convierten en 0). */
function coordenada(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ubicación del incidente: la de la posición que lo originó o, en un panel,
 * la del inmueble. null si no hay (alerta sin ubicación medida).
 */
function ubicacionIncidente(item: Incidentes, unidad: UnidadIncidente | null): { lat: number | null; lng: number | null } {
  if (Number(item.tipoOrigen) === TipoOrigenIncidente.POSICION) {
    return { lat: coordenada(datoOrigen(item, 'lat')), lng: coordenada(datoOrigen(item, 'lng')) };
  }
  return { lat: coordenada(unidad?.lat), lng: coordenada(unidad?.lng) };
}

/** Estado de la posición que originó el incidente (2 = alerta primaria, 8 = geocerca…). */
export function estadoIncidente(item: Incidentes): number | null {
  if (Number(item.tipoOrigen) !== TipoOrigenIncidente.POSICION) return null;
  const raw = datoOrigen(item, 'estado');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function mapIncidentePlano(
  item: Incidentes,
  incluirSeguimientos = false,
  unidad: UnidadIncidente | null = null,
) {
  const seguimientos = incluirSeguimientos
    ? [...(item.seguimientoIncidentes ?? [])]
        .sort((a, b) => {
          const ta = new Date(a.fechaHora).getTime();
          const tb = new Date(b.fechaHora).getTime();
          if (ta !== tb) return ta - tb;
          return Number(a.id) - Number(b.id);
        })
        .map((s) => mapSeguimientoPlano(s))
    : undefined;

  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    tipoOrigen: Number(item.tipoOrigen),
    idPosicion: item.idPosicion != null ? Number(item.idPosicion) : null,
    idPosicionOrigen:
      item.idPosicionOrigen != null ? Number(item.idPosicionOrigen) : null,
    idEventoAlarma:
      item.idEventoAlarma != null ? Number(item.idEventoAlarma) : null,
    idEventoAlarmaOrigen:
      item.idEventoAlarmaOrigen != null
        ? Number(item.idEventoAlarmaOrigen)
        : null,
    datosOrigen: item.datosOrigen,
    idUsuario: item.idUsuario != null ? Number(item.idUsuario) : null,
    nombreUsuario: nombreUsuario(item.idUsuario2) ?? item.idUsuario2?.userName ?? null,
    descripcion: item.descripcion,
    fechaInicio: item.fechaInicio,
    fechaCierre: item.fechaCierre,
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
    // Datos planos para Consola (estado de alerta + unidad).
    estado: estadoIncidente(item),
    nombreEstado: etiquetaEstadoPosicion(estadoIncidente(item)),
    imei: imeiIncidente(item),
    idInstalacion: unidad?.idInstalacion ?? null,
    economico: unidad?.economico ?? null,
    placas: unidad?.placas ?? null,
    marca: unidad?.marca ?? null,
    modelo: unidad?.modelo ?? null,
    nombreProducto: unidad?.nombreProducto ?? null,
    /** Panel: nombre del inmueble (también en `nombreProducto`). */
    inmueble: unidad?.inmueble ?? null,
    ...ubicacionIncidente(item, unidad),
    ...(incluirSeguimientos ? { seguimientos } : {}),
  };
}

export function nombreIncidente(item: Incidentes): string {
  const desc = item.descripcion?.trim();
  if (desc) return desc;
  return `Incidente ${item.id}`;
}

import { Incidentes } from 'src/entities/Incidentes';
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

export function mapIncidentePlano(
  item: Incidentes,
  incluirSeguimientos = false,
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
    ...(incluirSeguimientos ? { seguimientos } : {}),
  };
}

export function nombreIncidente(item: Incidentes): string {
  const desc = item.descripcion?.trim();
  if (desc) return desc;
  return `Incidente ${item.id}`;
}

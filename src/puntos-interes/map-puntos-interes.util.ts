import { PuntosInteres } from 'src/entities/PuntosInteres';
import { nombreCliente } from 'src/productos/map-relaciones.util';

export const RELACIONES_PUNTO_INTERES = ['idCliente2'] as const;

export function mapPuntoInteresPlano(item: PuntosInteres) {
  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    nombre: item.nombre,
    descripcion: item.descripcion,
    lng: item.lng != null ? Number(item.lng) : null,
    lat: item.lat != null ? Number(item.lat) : null,
    icono: item.icono,
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
  };
}

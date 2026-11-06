import { PuntosInteres } from 'src/entities/PuntosInteres';
import { nombreCliente } from 'src/productos/map-relaciones.util';
import type { VehiculoLigado } from 'src/productos/vehiculos-ligados.util';

export const RELACIONES_PUNTO_INTERES = ['idCliente2', 'productosPuntoInteres'] as const;

/** `vehiculos`: los que avisan llegada y salida de este punto (`ProductosPuntoInteres`). */
export function mapPuntoInteresPlano(item: PuntosInteres, vehiculos?: VehiculoLigado[]) {
  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    nombre: item.nombre,
    descripcion: item.descripcion,
    lng: item.lng != null ? Number(item.lng) : null,
    lat: item.lat != null ? Number(item.lat) : null,
    radioMetros: item.radioMetros != null ? Number(item.radioMetros) : 25,
    icono: item.icono,
    ...(vehiculos ? { idsProducto: vehiculos.map((v) => v.idProducto), vehiculos } : {}),
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
  };
}

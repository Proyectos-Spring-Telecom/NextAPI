import { Geocercas } from 'src/entities/Geocercas';
import { UsuariosGeocerca } from 'src/entities/UsuariosGeocerca';
import { nombreCliente } from 'src/productos/map-relaciones.util';

export const RELACIONES_GEOCERCA = [
  'idCliente2',
  'usuariosGeocerca',
  'usuariosGeocerca.idUsuario2',
] as const;

export function mapUsuariosGeocercaPlano(items: UsuariosGeocerca[] | undefined) {
  return (items ?? [])
    .filter((ug) => Number(ug.estatus) === 1)
    .map((ug) => ({
      id: Number(ug.id),
      idUsuario: Number(ug.idUsuario),
      nombreUsuario:
        [
          ug.idUsuario2?.nombre,
          ug.idUsuario2?.apellidoPaterno,
          ug.idUsuario2?.apellidoMaterno,
        ]
          .filter(Boolean)
          .join(' ')
          .trim() || ug.idUsuario2?.userName || null,
      estatus: Number(ug.estatus),
    }));
}

/**
 * `idInstalacion` es de compatibilidad (obsoleto): la instalación activa del
 * vehículo, GPS antes que TrackCam o reloj. La geocerca cuelga de `idProducto`.
 */
export function mapGeocercaPlano(item: Geocercas, idInstalacion: number | null = null) {
  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    idProducto: item.idProducto != null ? Number(item.idProducto) : null,
    idInstalacion,
    nombre: item.nombre,
    descripcion: item.descripcion,
    geocerca: item.geocerca,
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
    usuariosGeocerca: mapUsuariosGeocercaPlano(item.usuariosGeocerca),
  };
}

import { Geocercas } from 'src/entities/Geocercas';
import { nombreCliente } from 'src/productos/map-relaciones.util';
import type { VehiculoLigado } from 'src/productos/vehiculos-ligados.util';

export const RELACIONES_GEOCERCA = ['idCliente2', 'productosGeocerca'] as const;


/**
 * La geocerca es del cliente y aplica a los vehículos de `vehiculos`.
 * `idProducto` e `idInstalacion` son de compatibilidad (obsoletos): los del
 * primer vehículo.
 */
export function mapGeocercaPlano(item: Geocercas, vehiculos: VehiculoLigado[] = []) {
  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    idsProducto: vehiculos.map((v) => v.idProducto),
    vehiculos,
    idProducto: vehiculos[0]?.idProducto ?? null,
    idInstalacion: vehiculos[0]?.idInstalacion ?? null,
    nombre: item.nombre,
    descripcion: item.descripcion,
    geocerca: item.geocerca,
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
  };
}

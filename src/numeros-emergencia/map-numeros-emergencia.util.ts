import { NumerosEmergenciaCliente } from 'src/entities/NumerosEmergenciaCliente';
import { nombreCliente } from 'src/productos/map-relaciones.util';

export const RELACIONES_NUMERO_EMERGENCIA = ['idCliente2'] as const;

export function mapNumeroEmergenciaPlano(item: NumerosEmergenciaCliente) {
  return {
    id: Number(item.id),
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(item.idCliente2),
    nombre: item.nombre,
    telefono: item.telefono,
    descripcion: item.descripcion,
    prioridad: Number(item.prioridad),
    estatus: Number(item.estatus),
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
  };
}

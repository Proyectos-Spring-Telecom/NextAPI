import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Clientes } from 'src/entities/Clientes';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';

export function nombreCliente(cliente?: Clientes | null): string | null {
  if (!cliente) return null;
  const partes = [
    cliente.nombre,
    cliente.apellidoPaterno,
    cliente.apellidoMaterno,
  ].filter((parte) => parte?.trim());
  return partes.length > 0 ? partes.join(' ') : null;
}

export function nombreUsuario(usuario?: Usuarios | null): string | null {
  if (!usuario) return null;
  const partes = [
    usuario.nombre,
    usuario.apellidoPaterno,
    usuario.apellidoMaterno,
  ].filter((parte) => parte?.trim());
  return partes.length > 0 ? partes.join(' ') : null;
}

export function mapClienteRelacion(cliente?: Clientes | null) {
  if (!cliente) return null;
  return {
    id: Number(cliente.id),
    rfc: cliente.rfc,
    nombre: nombreCliente(cliente),
  };
}

export function mapTipoProductoRelacion(tipo?: CatTipoProducto | null) {
  if (!tipo) return null;
  return {
    id: Number(tipo.id),
    codigo: tipo.codigo,
    nombre: tipo.nombre,
  };
}

export function mapProductoCabecera(producto?: Productos | null) {
  if (!producto) return null;
  return {
    id: Number(producto.id),
    nombre: producto.nombre,
    estatus: Number(producto.estatus),
    tipoProducto: mapTipoProductoRelacion(producto.idTipoProducto2),
  };
}

export const RELACIONES_PRODUCTO_BASE = [
  'idCliente2',
  'idTipoProducto2',
] as const;

export const RELACIONES_DETALLE_PRODUCTO = {
  idProducto2: {
    idCliente2: true,
    idTipoProducto2: true,
  },
} as const;

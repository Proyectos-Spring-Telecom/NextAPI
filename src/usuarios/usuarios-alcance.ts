import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EnumRoles } from 'src/common/estatus.enum';

/**
 * Reglas de quién administra usuarios (auditoría C1, escalada de rol).
 * Funciones puras: el alcance por cliente lo resuelve `TenantFilterService`.
 */

/**
 * Roles que crean usuarios, editan a otros, cambian su estatus y les asignan
 * instalaciones: SA, Dev, Admin, Jefe de monitoreo (solo a sus operadores) y
 * Cliente (solo usuarios de su árbol).
 */
export const ROLES_ADMIN_USUARIOS: readonly number[] = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.CLIENTE,
];

/** El jefe de monitoreo administra a los monitoristas (5) y operadores (7) (decisión del 30/10/2026). */
const ROLES_DEL_JEFE_MONITOREO: readonly number[] = [EnumRoles.MONITOREO, EnumRoles.OPERADOR];

/**
 * Roles que solo pueden dar permisos y soluciones que ellos mismos tienen
 * (decisión del 30/10/2026: el cliente no reparte más de lo que tiene).
 */
export const ROLES_PERMISOS_ACOTADOS: readonly number[] = [EnumRoles.JEFE_MONITOREO, EnumRoles.CLIENTE];

/** Roles que pueden cambiar sus propios permisos y soluciones al editarse a sí mismos. */
const ROLES_PERMISOS_PROPIOS: readonly number[] = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN];

/** 403 si el rol no administra usuarios. */
export function assertPuedeAdministrarUsuarios(rolActor: number): void {
  if (!ROLES_ADMIN_USUARIOS.includes(Number(rolActor))) {
    throw new ForbiddenException('No tienes permiso para administrar usuarios');
  }
}

/**
 * 403 si el usuario destino tiene un rol de mayor jerarquía (número menor) que
 * quien lo administra. El SA (1) administra a todos.
 */
export function assertJerarquiaUsuarioDestino(rolActor: number, rolDestino: number): void {
  if (Number(rolActor) === EnumRoles.JEFE_MONITOREO && !ROLES_DEL_JEFE_MONITOREO.includes(Number(rolDestino))) {
    throw new ForbiddenException('El jefe de monitoreo solo administra monitoristas y operadores');
  }
  if (Number(rolDestino) < Number(rolActor)) {
    throw new ForbiddenException('No puedes administrar un usuario con un rol de mayor jerarquía que el tuyo');
  }
}

/**
 * Rol que queda en el alta o la edición de otro usuario.
 * - Cliente (6): siempre Usuario (9), se ignora el body (comportamiento previo).
 * - SA (1): cualquiera. Dev (2) y Admin (3): solo un rol >= al suyo (2 → 2..9, 3 → 3..9).
 * - `obligatorio` (alta): sin `idRol` en el body → 400. En edición, omitirlo = no cambiar.
 */
export function resolveIdRolAsignable(
  rolActor: number,
  idRolBody: number | undefined,
  obligatorio: boolean,
): number | undefined {
  const actor = Number(rolActor);
  if (actor === EnumRoles.CLIENTE) {
    return obligatorio || idRolBody !== undefined ? EnumRoles.USUARIO : undefined;
  }
  if (idRolBody === undefined || idRolBody === null) {
    if (obligatorio) throw new BadRequestException('idRol es obligatorio.');
    return undefined;
  }
  const idRol = Number(idRolBody);
  if (!Number.isInteger(idRol) || idRol < 1) {
    throw new BadRequestException('idRol inválido.');
  }
  if (actor === EnumRoles.JEFE_MONITOREO && !ROLES_DEL_JEFE_MONITOREO.includes(idRol)) {
    throw new ForbiddenException('El jefe de monitoreo solo da de alta monitoristas (5) y operadores (7)');
  }
  if (idRol < actor) {
    throw new ForbiddenException('No puedes asignar un rol de mayor jerarquía que el tuyo');
  }
  return idRol;
}

/** Lo que un usuario intenta cambiar de sí mismo en PATCH /usuarios/:id. */
export interface CambioPropio {
  rolActor: number;
  idRolActual: number;
  idClienteActual: number;
  idRolBody?: number;
  idClienteBody?: number;
  /** true si `permisosIds` o `solucionesIds` difieren de lo que tiene activo. */
  cambiaPermisosOSoluciones: boolean;
}

/**
 * Editarse a sí mismo: cualquier rol, pero sin cambiar su rol ni su cliente (403).
 * Permisos y soluciones propios solo los cambian SA, Dev y Admin.
 */
export function assertEdicionPropia(c: CambioPropio): void {
  if (c.idRolBody !== undefined && c.idRolBody !== null && Number(c.idRolBody) !== Number(c.idRolActual)) {
    throw new ForbiddenException('No puedes cambiar tu propio rol');
  }
  if (c.idClienteBody !== undefined && c.idClienteBody !== null && Number(c.idClienteBody) !== Number(c.idClienteActual)) {
    throw new ForbiddenException('No puedes cambiar tu propio cliente');
  }
  if (c.cambiaPermisosOSoluciones && !ROLES_PERMISOS_PROPIOS.includes(Number(c.rolActor))) {
    throw new ForbiddenException('No puedes cambiar tus propios permisos o soluciones');
  }
}

/** true si la lista recibida (sin duplicados) es distinta del conjunto actual. */
export function difiereConjunto(recibidos: number[], actuales: number[]): boolean {
  const a = new Set(recibidos.map(Number));
  const b = new Set(actuales.map(Number));
  if (a.size !== b.size) return true;
  for (const id of a) if (!b.has(id)) return true;
  return false;
}

/** 403 si se intenta dar un permiso o solución que quien administra no tiene. */
export function assertSubconjunto(recibidos: number[], propios: number[], que: 'permisos' | 'soluciones'): void {
  const tengo = new Set(propios.map(Number));
  const ajenos = [...new Set(recibidos.map(Number))].filter((id) => !tengo.has(id));
  if (ajenos.length) {
    throw new ForbiddenException(`Solo puedes otorgar ${que} que tú tienes (no tienes: ${ajenos.join(', ')})`);
  }
}


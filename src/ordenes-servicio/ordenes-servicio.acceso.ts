import { EnumRoles } from 'src/common/estatus.enum';

/**
 * Quién puede qué en las órdenes de servicio: un solo lugar para los roles y la
 * pertenencia (antes repartidos en el servicio, el flujo, el PDF y el controlador).
 * docs/ordenes-servicio.md §3 y §12.7.
 */

export interface UsuarioOrden {
  userId: number;
  rol: number;
}

/** Administración: programa, reprograma, cancela, cierra por otro y ajusta el cobro. */
export const ROLES_ADMIN = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN] as const;
/** Monitoreo: ve todas las órdenes, dicta códigos y valida pruebas; no edita. */
export const ROLES_MONITOREO = [EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO] as const;
/** Escriben en una orden: administración y el técnico (solo las suyas). */
export const ROLES_ESCRIBEN = [...ROLES_ADMIN, EnumRoles.TECNICO] as const;
/** Leen órdenes: los que escriben más monitoreo. */
export const ROLES_LEEN = [...ROLES_ESCRIBEN, ...ROLES_MONITOREO] as const;
/** Ven y dictan el código, ven y validan pruebas: cualquier operador en turno. */
export const ROLES_TURNO = [...ROLES_ADMIN, ...ROLES_MONITOREO] as const;
/** Deciden la autorización de desinstalar: administración y jefe de monitoreo. */
export const ROLES_AUTORIZAN = [...ROLES_ADMIN, EnumRoles.JEFE_MONITOREO] as const;

const tiene = (lista: readonly number[], rol: number) => lista.includes(Number(rol));

export const esAdmin = (u: UsuarioOrden) => tiene(ROLES_ADMIN, u.rol);
export const esMonitoreo = (u: UsuarioOrden) => tiene(ROLES_MONITOREO, u.rol);
export const esTecnicoAsignado = (o: { idTecnico: number }, u: UsuarioOrden) =>
  Number(o.idTecnico) === Number(u.userId);

/** Ver una orden: administración y monitoreo todas; el técnico solo las suyas. */
export const puedeVer = (o: { idTecnico: number }, u: UsuarioOrden) =>
  esAdmin(u) || esMonitoreo(u) || esTecnicoAsignado(o, u);

/** Editar una orden: administración todas; el técnico solo las suyas; monitoreo ninguna. */
export const puedeEditar = (o: { idTecnico: number }, u: UsuarioOrden) =>
  esAdmin(u) || esTecnicoAsignado(o, u);

/**
 * Compartir el PDF con el cliente (WhatsApp, correo): el técnico que la hizo y
 * administración. Monitoreo la ve pero no la envía.
 */
export const puedeCompartir = puedeEditar;

/** Nombre completo de un usuario o cliente (Nombre ApellidoPaterno ApellidoMaterno). */
export const nombreCompleto = (
  x?: { nombre?: string | null; apellidoPaterno?: string | null; apellidoMaterno?: string | null } | null,
): string | null => (x ? [x.nombre, x.apellidoPaterno, x.apellidoMaterno].filter(Boolean).join(' ') || null : null);

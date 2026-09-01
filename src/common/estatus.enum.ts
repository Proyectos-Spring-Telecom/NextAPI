export enum EstatusEnum {
  ACTIVO = 1, //activo o no usado
  INACTIVO = 0, //inactivo usado
}

/** Ciclo operativo de recursos (SIM, etc.). */
export enum EnumEstatusRecurso {
  /** 0 — inactivo */
  INACTIVO = 0,
  /** @deprecated Preferir INACTIVO */
  BAJA = 0,
  /** 1 — activo / disponible */
  ACTIVO = 1,
  /** @deprecated Preferir ACTIVO */
  DISPONIBLE = 1,
  ASIGNADO = 2,
  REVISION = 3,
  BAJA_MANTENIMIENTO = 4,
  /** @deprecated Preferir BAJA_MANTENIMIENTO */
  REMOVIDO = 4,
  INSERVIBLE = 5,
}

/** Permitidos en PATCH .../estatus/:id de SIMs */
export const ESTATUS_SIM_PATCH: readonly EnumEstatusRecurso[] = [
  EnumEstatusRecurso.INACTIVO,
  EnumEstatusRecurso.ACTIVO,
  EnumEstatusRecurso.ASIGNADO,
  EnumEstatusRecurso.REVISION,
  EnumEstatusRecurso.BAJA_MANTENIMIENTO,
  EnumEstatusRecurso.INSERVIBLE,
] as const;

/**
 * Estatus de Productos / Dispositivos (columna Estatus).
 *
 * 0 INACTIVO | 1 ACTIVO (disponible) | 2 ASIGNADO |
 * 3 BAJA_REMPLAZO | 4 BAJA_MANTENIMIENTO | 5 INSERVIBLE
 */
export enum EnumEstatusProductoDispositivo {
  INACTIVO = 0,
  ACTIVO = 1,
  ASIGNADO = 2,
  BAJA_REMPLAZO = 3,
  BAJA_MANTENIMIENTO = 4,
  INSERVIBLE = 5,
}

/** Permitidos en PATCH .../estatus/:id de productos y dispositivos */
export const ESTATUS_PRODUCTO_DISPOSITIVO_PATCH: readonly EnumEstatusProductoDispositivo[] =
  [
    EnumEstatusProductoDispositivo.INACTIVO,
    EnumEstatusProductoDispositivo.ACTIVO,
    EnumEstatusProductoDispositivo.ASIGNADO,
    EnumEstatusProductoDispositivo.BAJA_REMPLAZO,
    EnumEstatusProductoDispositivo.BAJA_MANTENIMIENTO,
    EnumEstatusProductoDispositivo.INSERVIBLE,
  ] as const;

/** Dispositivos que pueden recibir telemetría JT808 (inventario o instalados). */
export const ESTATUS_DISPOSITIVO_INGEST_TELEMETRIA: readonly EnumEstatusProductoDispositivo[] =
  [
    EnumEstatusProductoDispositivo.ACTIVO,
    EnumEstatusProductoDispositivo.ASIGNADO,
  ] as const;

export enum TipoCodigoAutenticacion {
  CONFIRMACION_CORREO = 0,
  RECUPERACION_CONTRASENA = 1,
}

/**
 * Valores de Roles.Id (tabla Roles en BD Next).
 * Nombre corto en BD → clave del enum.
 */
export enum EnumRoles {
  /** SA — Supér Administrador */
  SA = 1,
  /** Dev — Desarrollador */
  DEV = 2,
  /** Admin — Administrador De Sistema */
  ADMIN = 3,
  /** JefeMonitoreo — Encargado Area Monitoreo */
  JEFE_MONITOREO = 4,
  /** Monitoreo — Monitorista */
  MONITOREO = 5,
  /** Cliente — Cliente Del Sistema */
  CLIENTE = 6,
  /** Operador — Operador De Unidades */
  OPERADOR = 7,
  /** Técnico */
  TECNICO = 8,
  /** Usuario */
  USUARIO = 9,
}

/** Roles con visibilidad global (sin restricción por cliente en listados). */
export const ROLES_ACCESO_GLOBAL: readonly EnumRoles[] = [
  EnumRoles.SA,
  EnumRoles.DEV,
];

export function esRolAccesoGlobal(rol: number): boolean {
  return (ROLES_ACCESO_GLOBAL as readonly number[]).includes(rol);
}

/** Roles que pueden cambiar la contraseña de otro usuario (campo idUsuario en el body). */
export const ROLES_CAMBIO_CONTRASENA_OTRO_USUARIO: readonly EnumRoles[] = [
  EnumRoles.SA,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
];

export function esRolCambioContrasenaOtroUsuario(rol: number): boolean {
  return (ROLES_CAMBIO_CONTRASENA_OTRO_USUARIO as readonly number[]).includes(
    rol,
  );
}

/** Valores de Modulos.Id */
export enum EnumModulos {
  CLIENTES = 1,
  USUARIOS = 2,
  ROLES = 3,
  PERMISOS = 4,
  MODULOS = 5,
  SIMS = 14,
  DISPOSITIVOS = 15,
  VEHICULOS = 16,
  INSTALACIONES = 17,
  OPERADORES = 18,
  LICENCIAS = 19,
  INMUEBLES = 20,
  PANELES = 21,
  ALARMAS = 22,
  REPORTES = 23,
  ACTIVOS = 24,
  PERSONAS = 25,
}

/** Valores de CatTipoProducto.Id */
export enum EnumTipoProducto {
  VEHICULO = 1,
  ACTIVO = 2,
  INMUEBLE = 3,
  PERSONA = 4,
}

/**
 * Valores relevantes de CatTipoDispositivo.Id para el paginado.
 * 1, 3, 4 → solo campos de Dispositivos.
 * 2 → Dispositivos + PanelAlarma.
 */
export enum EnumTipoDispositivo {
  PANEL_ALARMA = 2,
}

/** Valores de CatProductos.Id (categoría de marcas) */
export enum EnumCatProducto {
  DISPOSITIVO = 1,
  VEHICULO = 2,
  ACTIVO = 3,
  TELEFONO = 4,
  PANEL = 5,
}

/**
 * Valores de CatEstatusInstalacion.Id / Instalaciones.EstatusInstalacion.
 *
 * 0 INACTIVO | 1 ACTIVA | 2 ASIGNADO | 3 BAJA_REMPLAZO | 4 BAJA_MANTENIMIENTO | 5 INSERVIBLE
 */
export enum EnumEstatusInstalacion {
  INACTIVO = 0,
  ACTIVA = 1,
  ASIGNADO = 2,
  BAJA_REMPLAZO = 3,
  BAJA_MANTENIMIENTO = 4,
  INSERVIBLE = 5,
}

/** Permitidos en PATCH /instalaciones/estatus/:id */
export const ESTATUS_INSTALACION_PATCH: readonly EnumEstatusInstalacion[] = [
  EnumEstatusInstalacion.INACTIVO,
  EnumEstatusInstalacion.ACTIVA,
  EnumEstatusInstalacion.INSERVIBLE,
] as const;

/**
 * Estatus permitidos en el body de PATCH /instalaciones/:id
 * (contexto archivado en HistoricoInstalaciones).
 */
export const ESTATUS_INSTALACION_UPDATE_HISTORICO: readonly EnumEstatusInstalacion[] =
  [
    EnumEstatusInstalacion.INACTIVO,
    EnumEstatusInstalacion.ACTIVA,
    EnumEstatusInstalacion.BAJA_REMPLAZO,
    EnumEstatusInstalacion.BAJA_MANTENIMIENTO,
    EnumEstatusInstalacion.INSERVIBLE,
  ] as const;

/**
 * @deprecated El PATCH estatus ya no archiva; se conserva por compatibilidad.
 * Preferir ESTATUS_INSTALACION_PATCH (0, 1, 5).
 */
export const ESTATUS_INSTALACION_BAJA: readonly EnumEstatusInstalacion[] = [
  EnumEstatusInstalacion.INACTIVO,
  EnumEstatusInstalacion.INSERVIBLE,
] as const;

/** Acciones registradas en HistoricoInstalaciones.Accion */
export enum EnumAccionHistoricoInstalacion {
  ALTA = 'Alta',
  CAMBIO_PRODUCTO = 'Cambio de producto',
  CAMBIO_DISPOSITIVO = 'Cambio de dispositivo',
  CAMBIO_SIM = 'Cambio de SIM',
  BAJA = 'Baja',
  SUSPENSION = 'Suspensión',
}

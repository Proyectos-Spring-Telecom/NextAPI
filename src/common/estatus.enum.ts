export enum EstatusEnum {
  ACTIVO = 1, //activo o no usado
  INACTIVO = 0, //inactivo usado
}

/** Ciclo operativo de recursos (SIM, dispositivo, etc.). */
export enum EnumEstatusRecurso {
  BAJA = 0,
  DISPONIBLE = 1,
  ASIGNADO = 2,
  REVISION = 3,
  REMOVIDO = 4,
}

export enum TipoCodigoAutenticacion {
  CONFIRMACION_CORREO = 0,
  RECUPERACION_CONTRASENA = 1,
}

export enum EnumModulos {
  CLIENTES = 1,
  USUARIOS = 2,
  ROLES = 3,
  PERMISOS = 4,
  MODULOS = 5,
  USUARIOSPERMISOS = 6,
  USUARIOSINSTALACIONES = 8,
  OPERADORES = 9,
  VEHICULOS = 16,
  DISPOSITIVOS = 11,
  BLUEVOXS = 12,
  INSTALACIONES = 13,
  SIMS = 14,
  BITACORA = 0,
  CONTEOPASAJEROS = 23,
  POSICIONES = 24,
  TRANSACCIONES = 25,
  ADMINISTRACION = 26,
  MONITOREO = 27,
  VIAJESCONTEOS = 28,
  VIAJESTRANSACCIONES = 29,
  HISTORICOTRANSACCIONES = 30,
  CATALOGOPASAJERO = 31,
  INMUEBLES = 20,
  PANELALARMA = 21,
  PRODUCTOS = 32,
  ACTIVOS = 33,
  PERSONAS = 34,
}

/** Valores de CatTipoProducto.Id */
export enum EnumTipoProducto {
  VEHICULO = 1,
  ACTIVO = 2,
  INMUEBLE = 3,
  PERSONA = 4,
}




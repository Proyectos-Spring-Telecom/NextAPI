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

/** Valores de CatProductos.Id (categoría de marcas) */
export enum EnumCatProducto {
  DISPOSITIVO = 1,
  VEHICULO = 2,
  ACTIVO = 3,
  TELEFONO = 4,
  PANEL = 5,
}




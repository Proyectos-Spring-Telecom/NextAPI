export enum EstatusEnum {
  ACTIVO = 1, //activo o no usado
  INACTIVO = 0, //inactivo usado
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
  USUARIOSREGIONES = 7,
  USUARIOSINSTALACIONES = 8,
  OPERADORES = 9,
  VEHICULOS = 16,
  DISPOSITIVOS = 11,
  BLUEVOXS = 12,
  INSTALACIONES = 13,
  TURNOS = 14,
  VIAJES = 15,
  REGIONES = 16,
  RUTAS = 17,
  DERROTEROS = 18,
  TARIFAS = 19,
  MONEDEROS = 20,
  PASAJEROS = 21,
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
}

export enum EnumSolicitudPasajero {
  NOSOLICITADO = 0,
  SOLICITADO = 1,
  APROBADO = 2,
  RECHAZADO = 3,
}

export enum EnumFiltros {
  ALDIA = 1,
  SEMANA = 2,
  MES = 3,
}

/** Valores de CatTipoVerificaciones (catálogo eliminado; referencia de dominio). */
export enum EnumTipoVerificacion {
  VERIFICACION_MECANICA = 1,
  VERIFICACION_AMBIENTAL = 2,
}

/** Valores de EstatusSim en tabla Sims (antes CatEstatusSim). */
export enum EnumEstatusSim {
  DISPONIBLE = 1, // SIM adquirido pero sin asignar a ningún dispositivo
  ASIGNADO = 2, // SIM operativo con servicio activo
  BAJA = 3, // SIM dado de baja 
  BAJA_CAMBIO = 4, // SIM dado de baja por cambio de sim
}

/** Valores de EstatusDispositivo en tabla Dispositivos (antes CatEstatusDispositivo). */
export enum EnumEstatusDispositivo {
  DISPONIBLE = 1, // Dispositivo en inventario sin asignar a ningún vehículo
  ASIGNADO = 2, // Dispositivo instalado y transmitiendo correctamente
  BAJA = 3,
  MANTENIMIENTO = 4, // Dispositivo retirado temporalmente para revisión o reparación
}

/** Valores de CatReferenciaServicio (catálogo eliminado; referencia de dominio). */
export enum EnumReferenciaServicio {
  POR_KILOMETRAJE = 1,
  POR_TIEMPO = 2,
}


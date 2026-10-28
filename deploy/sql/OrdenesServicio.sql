-- Órdenes de servicio: evidencia de cada visita del técnico (alta, cambio de
-- equipo, cambio de SIM, desinstalación o revisión) ligada a Instalaciones.
-- Docs: docs/contratos.md §14.1. Aplicar una vez en la base `Next`.
--
-- Una orden = un tipo de servicio. Nace en borrador (guardado parcial), se llena
-- por secciones y al cerrarla aplica el movimiento en Instalaciones en la misma
-- transacción. Sin FK a Instalaciones a propósito: PATCH /instalaciones borra la
-- fila anterior y crea otra con Id nuevo; la orden guarda los dos Id.

CREATE TABLE IF NOT EXISTS `CatOrdenServicioOpciones` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Seccion` VARCHAR(32) NOT NULL COMMENT 'vehiculo_cuenta_con | funcionamiento_vehiculo | fallas_equipo | pruebas | fotos | firmas',
  `Clave` VARCHAR(40) NOT NULL,
  `Nombre` VARCHAR(120) NOT NULL,
  `Obligatorio` TINYINT NOT NULL DEFAULT 0 COMMENT 'Solo fotos/firmas: debe existir el archivo para cerrar',
  `Orden` INT NOT NULL DEFAULT 0,
  `Estatus` TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatOrdenServicioOpciones_SeccionClave` (`Seccion`, `Clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `CatOrdenServicioOpciones` (`Seccion`, `Clave`, `Nombre`, `Obligatorio`, `Orden`) VALUES
  ('vehiculo_cuenta_con', 'boton_panico', 'Botón de pánico', 0, 1),
  ('vehiculo_cuenta_con', 'inmovilizador', 'Inmovilizador', 0, 2),
  ('vehiculo_cuenta_con', 'regulador', 'Regulador', 0, 3),
  ('vehiculo_cuenta_con', 'estereo', 'Estéreo', 0, 4),
  ('vehiculo_cuenta_con', 'alarma', 'Alarma', 0, 5),
  ('funcionamiento_vehiculo', 'tablero_iniciar', 'Tablero correcto al iniciar', 0, 1),
  ('funcionamiento_vehiculo', 'tablero_final', 'Tablero correcto al final', 0, 2),
  ('funcionamiento_vehiculo', 'unidad_iniciar', 'Unidad correcta al iniciar', 0, 3),
  ('funcionamiento_vehiculo', 'unidad_final', 'Unidad correcta al final', 0, 4),
  ('fallas_equipo', 'mojado', 'Mojado', 0, 1),
  ('fallas_equipo', 'golpeado', 'Golpeado', 0, 2),
  ('fallas_equipo', 'cables_cortados', 'Cables cortados', 0, 3),
  ('fallas_equipo', 'cables_desconectados', 'Cables desconectados', 0, 4),
  ('fallas_equipo', 'otro', 'Otro (especificar en observaciones)', 0, 5),
  ('pruebas', 'transmision', 'Transmisión correcta', 0, 1),
  ('pruebas', 'boton_panico', 'Botón de pánico', 0, 2),
  ('pruebas', 'paro_motor', 'Paro de motor y movilización', 0, 3),
  ('fotos', 'tablero_inicio', 'Tablero al iniciar', 1, 1),
  ('fotos', 'tablero_final', 'Tablero al finalizar', 1, 2),
  ('fotos', 'falla_extra_1', 'Imagen extra 1', 0, 3),
  ('fotos', 'falla_extra_2', 'Imagen extra 2', 0, 4),
  ('fotos', 'falla_extra_3', 'Imagen extra 3', 0, 5),
  ('firmas', 'firma_cliente', 'Firma del cliente', 1, 1),
  ('firmas', 'firma_tecnico', 'Firma del técnico', 1, 2);

CREATE TABLE IF NOT EXISTS `OrdenesServicio` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Folio` VARCHAR(20) NULL COMMENT 'OS-000001, lo asigna el servidor al crear',
  `ClaveApp` CHAR(36) NOT NULL COMMENT 'UUID generado por la app: reenviar el alta no duplica la orden',
  `TipoServicio` VARCHAR(20) NOT NULL COMMENT 'instalacion | revision | c_sim | c_equipo | desinstalacion',
  `Estatus` VARCHAR(12) NOT NULL DEFAULT 'borrador' COMMENT 'borrador | cerrada | cancelada',
  `IdCliente` BIGINT NOT NULL,
  `IdInstalacion` BIGINT NULL COMMENT 'Instalación atendida (NULL en alta hasta cerrar)',
  `IdInstalacionResultado` BIGINT NULL COMMENT 'Instalación vigente tras cerrar (alta o cambio crean Id nuevo)',
  `IdHistoricoInstalacion` BIGINT NULL COMMENT 'Versión archivada por un cambio de equipo/SIM',
  `IdProducto` BIGINT NULL COMMENT 'Vehículo/activo; estable entre versiones de la instalación',
  `IdDispositivoNuevo` BIGINT NULL COMMENT 'Alta o cambio de equipo',
  `IdSimNuevo` BIGINT NULL COMMENT 'Alta o cambio de SIM',
  `EstatusSalienteAnterior` TINYINT NULL COMMENT 'Cambio de equipo/SIM: estatus del que sale (EnumEstatusProductoDispositivo)',
  `EstatusInstalacionBaja` TINYINT NULL COMMENT 'Desinstalación: 0 inactiva | 5 inservible',
  `IdTecnico` BIGINT NOT NULL COMMENT 'Usuario del token que creó la orden',
  `IdMonitorista` BIGINT NULL COMMENT 'Usuario con rol 4/5',
  `FechaCaptura` DATETIME NULL COMMENT 'Reloj del dispositivo al registrar (hora de Ciudad de México)',
  `Lat` DOUBLE NULL,
  `Lng` DOUBLE NULL,
  `Observaciones` TEXT NULL,
  `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCierre` DATETIME NULL,
  `IdUsuarioCierre` BIGINT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_OrdenesServicio_ClaveApp` (`ClaveApp`),
  UNIQUE KEY `UQ_OrdenesServicio_Folio` (`Folio`),
  KEY `IX_OrdenesServicio_Cliente_Fecha` (`IdCliente`, `FechaCreacion`),
  KEY `IX_OrdenesServicio_Instalacion` (`IdInstalacion`),
  KEY `IX_OrdenesServicio_InstalacionResultado` (`IdInstalacionResultado`),
  KEY `IX_OrdenesServicio_Producto` (`IdProducto`),
  KEY `IX_OrdenesServicio_Tecnico_Estatus` (`IdTecnico`, `Estatus`),
  CONSTRAINT `FK_OrdenesServicio_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `OrdenServicioRespuestas` (
  `IdOrdenServicio` BIGINT NOT NULL,
  `Seccion` VARCHAR(32) NOT NULL,
  `Clave` VARCHAR(40) NOT NULL,
  `Valor` TINYINT NOT NULL COMMENT '1 = sí / correcto; 0 = no. Se guardan todas, también las apagadas',
  PRIMARY KEY (`IdOrdenServicio`, `Seccion`, `Clave`),
  CONSTRAINT `FK_OrdenServicioRespuestas_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `OrdenServicioArchivos` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `IdOrdenServicio` BIGINT NOT NULL,
  `Clave` VARCHAR(40) NOT NULL COMMENT 'Clave de fotos/firmas en CatOrdenServicioOpciones',
  `Ruta` VARCHAR(500) NOT NULL COMMENT 'URL privada en S3; se lee con URL firmada',
  `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_OrdenServicioArchivos_OrdenClave` (`IdOrdenServicio`, `Clave`),
  CONSTRAINT `FK_OrdenServicioArchivos_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

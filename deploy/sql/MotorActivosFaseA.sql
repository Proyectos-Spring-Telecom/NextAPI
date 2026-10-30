-- Motor de activos, fase A (docs/motor-activos.md §1 y §4).
--
-- CatEstatusRecurso: dónde está y en qué condición un dispositivo o SIM. Mismos
-- números que ya usa la columna Estatus (no se migran datos): el 3 pasa a
-- llamarse "por revisar" (antes "baja por reemplazo" / "revisión") y el 4
-- "laboratorio" (antes "baja por mantenimiento").
--
-- MovimientosRecurso: historial de vida de cada dispositivo, SIM y producto.
-- Solo lo escribe el motor, en la misma transacción que el cambio. Sin llaves
-- foráneas: es evidencia y debe sobrevivir a correcciones de los recursos.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con fase A.

CREATE TABLE IF NOT EXISTS `CatEstatusRecurso` (
  `Id` tinyint NOT NULL,
  `Codigo` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatEstatusRecurso_Codigo` (`Codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `CatEstatusRecurso` (`Id`, `Codigo`, `Nombre`, `Descripcion`) VALUES
  (0, 'INACTIVO', 'Inactivo', 'Fuera de operación por decisión administrativa (reversible)'),
  (1, 'DISPONIBLE', 'Disponible', 'En almacén, listo para instalarse'),
  (2, 'INSTALADO', 'Instalado', 'En una instalación activa; solo lo pone una instalación'),
  (3, 'POR_REVISAR', 'Por revisar', 'Salió de una instalación; se revisa antes de volver a disponible'),
  (4, 'LABORATORIO', 'Laboratorio', 'En reparación'),
  (5, 'INSERVIBLE', 'Inservible', 'Baja definitiva (daño, vandalismo)')
ON DUPLICATE KEY UPDATE `Codigo` = VALUES(`Codigo`), `Nombre` = VALUES(`Nombre`), `Descripcion` = VALUES(`Descripcion`);

CREATE TABLE IF NOT EXISTS `MovimientosRecurso` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `TipoRecurso` varchar(12) NOT NULL COMMENT 'dispositivo | sim | producto',
  `IdRecurso` bigint NOT NULL,
  `Fecha` datetime NOT NULL,
  `Accion` varchar(20) NOT NULL COMMENT 'alta | instalacion | cambio | baja | reactivacion | estatus | traspaso',
  `EstatusAnterior` tinyint NULL,
  `EstatusNuevo` tinyint NOT NULL,
  `IdClienteAnterior` bigint NULL,
  `IdClienteNuevo` bigint NULL,
  `IdInstalacion` bigint NULL,
  `IdOrdenServicio` bigint NULL,
  `Motivo` varchar(500) NULL COMMENT 'Texto de quien hizo el cambio',
  `IdUsuario` bigint NULL,
  `Origen` varchar(10) NOT NULL COMMENT 'api | orden | sistema',
  PRIMARY KEY (`Id`),
  KEY `IX_MovRec_Recurso` (`TipoRecurso`, `IdRecurso`, `Fecha`),
  KEY `IX_MovRec_Instalacion` (`IdInstalacion`),
  KEY `IX_MovRec_Orden` (`IdOrdenServicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

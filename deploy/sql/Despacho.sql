-- Despacho de rutas y trabajos (13/11/2026, fase 6 de la ruta Fis Fiber).
--
-- RutasDespacho + RutasDespachoParadas: plantilla con la secuencia de puntos de
-- interés y, opcional, el horario de cada parada. TrabajosDespacho +
-- TrabajosDespachoParadas: lo asignado a una unidad en una fecha; las paradas
-- se copian de la ruta al crear el trabajo (editar la ruta no cambia el
-- historial). El cumplimiento (llegada, salida, a tiempo / tarde / no
-- visitada) se calcula al consultar con las posiciones: no hay tabla ni
-- proceso que lo escriba. El chofer es de ShiftControl: no se captura aquí.
--
-- Solo crea tablas nuevas. Aplicar en la base `Next` ANTES de desplegar
-- NextAPI con esta versión. Se puede correr dos veces.

CREATE TABLE IF NOT EXISTS `RutasDespacho` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(120) NOT NULL,
  `Descripcion` varchar(500) NULL,
  `Estatus` tinyint NOT NULL DEFAULT 1,
  `IdUsuario` bigint NOT NULL,
  `FechaCreacion` datetime NOT NULL,
  `FechaActualizacion` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_RutasDespacho_Cliente` (`IdCliente`, `Estatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `RutasDespachoParadas` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdRuta` bigint NOT NULL,
  `Orden` smallint NOT NULL,
  `IdPuntoInteres` bigint NOT NULL,
  `HoraDesde` time NULL COMMENT 'Inicio de la ventana de llegada (cada día)',
  `HoraHasta` time NULL COMMENT 'Fin de la ventana de llegada',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_RutasDespachoParadas_Orden` (`IdRuta`, `Orden`),
  CONSTRAINT `FK_RutasDespachoParadas_Ruta` FOREIGN KEY (`IdRuta`) REFERENCES `RutasDespacho` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `TrabajosDespacho` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdInstalacion` bigint NOT NULL,
  `IdRuta` bigint NULL,
  `Titulo` varchar(150) NOT NULL,
  `Notas` varchar(1000) NULL,
  `Fecha` date NOT NULL,
  `Inicio` datetime NOT NULL COMMENT 'Desde cuándo cuentan las llegadas (hora de México)',
  `Fin` datetime NOT NULL COMMENT 'Hasta cuándo cuentan',
  `Cancelado` tinyint NOT NULL DEFAULT 0,
  `MotivoCancelacion` varchar(300) NULL,
  `IdUsuario` bigint NOT NULL,
  `FechaCreacion` datetime NOT NULL,
  `FechaActualizacion` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_TrabajosDespacho_Cliente` (`IdCliente`, `Fecha`),
  KEY `IX_TrabajosDespacho_Instalacion` (`IdInstalacion`, `Fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `TrabajosDespachoParadas` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdTrabajo` bigint NOT NULL,
  `Orden` smallint NOT NULL,
  `IdPuntoInteres` bigint NOT NULL,
  `VentanaDesde` datetime NULL,
  `VentanaHasta` datetime NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_TrabajosDespachoParadas_Orden` (`IdTrabajo`, `Orden`),
  CONSTRAINT `FK_TrabajosDespachoParadas_Trabajo` FOREIGN KEY (`IdTrabajo`) REFERENCES `TrabajosDespacho` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

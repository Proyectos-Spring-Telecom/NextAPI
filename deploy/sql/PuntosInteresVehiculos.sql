-- Puntos de interés ligados a vehículos y avisos de llegada/salida en vivo
-- (decisión del 5/11/2026, mismo modelo que GeocercasVehiculos.sql).
--
-- El punto es del cliente y se liga a uno o varios vehículos (del cliente o
-- de sus hijos); un vehículo tiene uno o varios puntos. Con cada posición de
-- un vehículo ligado, Next compara si quedó dentro o fuera del radio y, si
-- cambió, guarda la llegada o la salida y la avisa por Socket.IO. No cambia el
-- Estado ni el IdEvento de la posición ni abre incidentes.
--
-- Una sola vez, en la base `Next`. Se puede aplicar antes de reiniciar: el
-- código anterior no usa estas tablas.

CREATE TABLE IF NOT EXISTS `ProductosPuntoInteres` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdProducto` bigint NOT NULL COMMENT 'Vehículo que avisa llegada/salida',
  `IdPuntoInteres` bigint NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_ProductoPuntoInteres` (`IdProducto`, `IdPuntoInteres`),
  KEY `IX_ProductoPuntoInteres_Punto` (`IdPuntoInteres`, `Estatus`),
  CONSTRAINT `FK_ProductoPuntoInteres_Producto` FOREIGN KEY (`IdProducto`) REFERENCES `Productos` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductoPuntoInteres_Punto` FOREIGN KEY (`IdPuntoInteres`) REFERENCES `PuntosInteres` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dentro o fuera del vehículo en cada punto (lo comparten sus equipos: GPS y
-- TrackCam del mismo vehículo no avisan dos veces). La primera posición solo
-- fija el estado, sin aviso.
CREATE TABLE IF NOT EXISTS `EstadoPuntoInteres` (
  `IdProducto` bigint NOT NULL,
  `IdPuntoInteres` bigint NOT NULL,
  `Dentro` tinyint NOT NULL,
  `FechaHora` datetime NOT NULL COMMENT 'De la posición que fijó el estado (hora de México)',
  PRIMARY KEY (`IdProducto`, `IdPuntoInteres`),
  CONSTRAINT `FK_EstadoPuntoInteres_Producto` FOREIGN KEY (`IdProducto`) REFERENCES `Productos` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_EstadoPuntoInteres_Punto` FOREIGN KEY (`IdPuntoInteres`) REFERENCES `PuntosInteres` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `EventosPuntoInteres` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdPuntoInteres` bigint NOT NULL,
  `IdProducto` bigint NOT NULL,
  `IdInstalacion` bigint NOT NULL,
  `IdPosicion` bigint NOT NULL,
  `Tipo` varchar(10) NOT NULL COMMENT 'llegada | salida',
  `FechaHora` datetime NOT NULL COMMENT 'De la posición (hora de México)',
  `FechaRegistro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_EventosPuntoInteres_Instalacion` (`IdInstalacion`, `FechaHora`),
  KEY `IX_EventosPuntoInteres_Punto` (`IdPuntoInteres`, `FechaHora`),
  KEY `IX_EventosPuntoInteres_Producto` (`IdProducto`, `FechaHora`),
  CONSTRAINT `FK_EventosPuntoInteres_Punto` FOREIGN KEY (`IdPuntoInteres`) REFERENCES `PuntosInteres` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Entradas y salidas de geocerca (13/11/2026, fase 2 de la ruta Fis Fiber).
--
-- Igual que EstadoPuntoInteres / EventosPuntoInteres: el estado dentro/fuera
-- es del vehículo en cada geocerca ligada (ProductosGeocerca) y lo comparten
-- sus equipos; cada cambio deja un evento. Lo escribe GeocercasAvisosService
-- fuera de la transacción de la ingesta, sin esperar. No toca el Estado 8 ni
-- los incidentes por geocerca.
--
-- Solo crea tablas nuevas. Aplicar en la base `Next` ANTES de desplegar
-- NextAPI con esta versión. Se puede correr dos veces.

CREATE TABLE IF NOT EXISTS `EstadoGeocerca` (
  `IdProducto` bigint NOT NULL,
  `IdGeocerca` bigint NOT NULL,
  `Dentro` tinyint NOT NULL,
  `FechaHora` datetime NOT NULL COMMENT 'De la posición que fijó el estado (hora de México)',
  PRIMARY KEY (`IdProducto`, `IdGeocerca`),
  CONSTRAINT `FK_EstadoGeocerca_Producto` FOREIGN KEY (`IdProducto`) REFERENCES `Productos` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_EstadoGeocerca_Geocerca` FOREIGN KEY (`IdGeocerca`) REFERENCES `Geocercas` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `EventosGeocerca` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdGeocerca` bigint NOT NULL,
  `IdProducto` bigint NOT NULL,
  `IdInstalacion` bigint NOT NULL,
  `IdPosicion` bigint NOT NULL,
  `Tipo` varchar(10) NOT NULL COMMENT 'entrada | salida',
  `FechaHora` datetime NOT NULL COMMENT 'De la posición (hora de México)',
  `FechaRegistro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_EventosGeocerca_Instalacion` (`IdInstalacion`, `FechaHora`),
  KEY `IX_EventosGeocerca_Geocerca` (`IdGeocerca`, `FechaHora`),
  KEY `IX_EventosGeocerca_Producto` (`IdProducto`, `FechaHora`),
  CONSTRAINT `FK_EventosGeocerca_Geocerca` FOREIGN KEY (`IdGeocerca`) REFERENCES `Geocercas` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

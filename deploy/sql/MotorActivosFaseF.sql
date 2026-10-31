-- Motor de activos, fase F (docs/motor-activos.md §8): comandos de Next a los
-- equipos y números de emergencia del reloj.
--
-- Idempotente: se puede correr más de una vez (CREATE TABLE IF NOT EXISTS).
-- Aplicar en la base `Next` antes de desplegar NextAPI con fase F.

-- Cada comando y su recorrido: pendiente (en Next) → publicado (en la cola) →
-- recibido (lo guardó el socket) → enviado (se escribió al equipo) →
-- confirmado (el equipo respondió). Terminales: confirmado, vencido, fallido.
CREATE TABLE IF NOT EXISTS `ComandosDispositivo` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdDispositivo` bigint NOT NULL,
  `Protocolo` varchar(10) NOT NULL COMMENT 'fa100s',
  `Tipo` varchar(20) NOT NULL COMMENT 'SOS | CENTER | PHB | PHB2 | PHB3 | FALLDOWN | LSSET | UPLOAD',
  `Contenido` varchar(500) NOT NULL COMMENT 'Cuerpo del comando sin corchetes',
  `Estatus` varchar(12) NOT NULL COMMENT 'pendiente | publicado | recibido | enviado | confirmado | vencido | fallido',
  `Detalle` varchar(500) NULL,
  `Intentos` int NOT NULL DEFAULT 0 COMMENT 'Publicaciones a la cola',
  `IdUsuario` bigint NULL,
  `Origen` varchar(10) NOT NULL COMMENT 'api | sistema',
  `VenceAt` datetime NOT NULL,
  `FechaCreacion` datetime NOT NULL,
  `FechaPublicado` datetime NULL,
  `FechaRecibido` datetime NULL,
  `FechaEnviado` datetime NULL,
  `FechaConfirmado` datetime NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ComandosDisp_Dispositivo` (`IdDispositivo`, `FechaCreacion`),
  KEY `IX_ComandosDisp_Estatus` (`Estatus`, `FechaCreacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Números de emergencia del reloj, de la persona (producto): si cambia el
-- reloj, los números se le vuelven a mandar al nuevo.
CREATE TABLE IF NOT EXISTS `NumerosEmergenciaReloj` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdProducto` bigint NOT NULL,
  `Tipo` varchar(8) NOT NULL COMMENT 'sos (1-3) | centro (1) | agenda (1-15)',
  `Orden` tinyint NOT NULL,
  `Nombre` varchar(20) NULL,
  `Telefono` varchar(20) NOT NULL,
  `IdUsuario` bigint NULL,
  `FechaActualizacion` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_NumEmergReloj_Producto_Tipo_Orden` (`IdProducto`, `Tipo`, `Orden`),
  KEY `IX_NumEmergReloj_Cliente` (`IdCliente`),
  CONSTRAINT `FK_NumEmergReloj_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

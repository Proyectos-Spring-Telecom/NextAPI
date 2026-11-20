-- Aviso masivo por correo (20/11/2026, pedido de Lalo: Consola → Informe De Sucesos → Aviso Masivo).
--
-- AvisosMasivos: un registro por aviso (quién, cuándo, asunto, totales). El
--   adjunto se guarda aquí mientras el aviso se envía (máx. 10 MB) y se borra
--   (NULL) al terminar: así un reinicio de NextAPI no pierde el envío.
-- AvisosMasivosDestinatarios: un renglón por usuario con su correo, el lote en
--   que sale (CCO de hasta AVISO_MASIVO_LOTE) y cómo le fue.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con este cambio.

CREATE TABLE IF NOT EXISTS `AvisosMasivos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdUsuario` bigint NOT NULL,
  `Asunto` varchar(200) NOT NULL,
  `Mensaje` text NOT NULL,
  `AdjuntoNombre` varchar(255) NULL,
  `AdjuntoTipo` varchar(120) NULL,
  `Adjunto` longblob NULL COMMENT 'Se borra al terminar el envío',
  `Total` int NOT NULL,
  `Omitidos` int NOT NULL DEFAULT 0 COMMENT 'Ids fuera de alcance, inactivos, sin correo o repetidos',
  `Enviados` int NOT NULL DEFAULT 0,
  `Fallidos` int NOT NULL DEFAULT 0,
  `Estatus` varchar(12) NOT NULL DEFAULT 'enviando' COMMENT 'enviando | terminado',
  `FechaCreacion` datetime NOT NULL,
  `FechaFin` datetime NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_AvisosMasivos_Estatus` (`Estatus`, `Id`),
  KEY `IX_AvisosMasivos_Usuario` (`IdUsuario`, `FechaCreacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `AvisosMasivosDestinatarios` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdAviso` bigint NOT NULL,
  `IdUsuario` bigint NOT NULL,
  `Correo` varchar(100) NOT NULL,
  `Lote` int NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT 0 COMMENT '0 pendiente, 1 enviado, 2 fallido',
  `Intentos` tinyint NOT NULL DEFAULT 0,
  `Error` varchar(300) NULL,
  `FechaEnvio` datetime NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_AvisosDest_Aviso` (`IdAviso`, `Estatus`, `Lote`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

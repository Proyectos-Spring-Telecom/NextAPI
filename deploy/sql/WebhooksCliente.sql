-- Webhooks por cliente (13/11/2026, fase 3 de la ruta Fis Fiber).
--
-- Next avisa al sistema del cliente por HTTPS con firma HMAC-SHA256
-- (encabezados X-Next-Evento, X-Next-Timestamp y X-Next-Firma). Una
-- suscripción de un cliente recibe los eventos de él y de sus hijos.
-- Los envíos pasan por EnviosWebhook (bandeja de salida con reintentos): un
-- cliente caído nunca frena la ingesta ni los incidentes.
--
-- No toca ShiftControl (WEBHOOK_SUBSCRIBERS sigue igual).
-- Solo crea tablas nuevas. Aplicar en la base `Next` ANTES de desplegar
-- NextAPI con esta versión. Se puede correr dos veces.

CREATE TABLE IF NOT EXISTS `SuscripcionesWebhook` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Url` varchar(500) NOT NULL COMMENT 'Solo https y destino público',
  `Secreto` char(64) NOT NULL COMMENT 'Para firmar (HMAC); se muestra una vez al crear',
  `Eventos` varchar(255) NOT NULL COMMENT 'Lista separada por comas',
  `IdUsuario` bigint NOT NULL,
  `FechaCreacion` datetime NOT NULL,
  `FechaRevocacion` datetime NULL,
  `Estatus` tinyint NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  KEY `IX_SuscripcionesWebhook_Cliente` (`IdCliente`, `Estatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `EnviosWebhook` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdSuscripcion` bigint NOT NULL,
  `Evento` varchar(40) NOT NULL,
  `Cuerpo` mediumtext NOT NULL COMMENT 'JSON exacto que se firma y se envía',
  `Estatus` varchar(10) NOT NULL DEFAULT 'pendiente' COMMENT 'pendiente | enviado | fallido',
  `Intentos` smallint NOT NULL DEFAULT 0,
  `ProximoIntento` datetime NOT NULL,
  `CodigoHttp` smallint NULL,
  `UltimoError` varchar(500) NULL,
  `FechaCreacion` datetime NOT NULL,
  `FechaEnvio` datetime NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_EnviosWebhook_Pendientes` (`Estatus`, `ProximoIntento`),
  KEY `IX_EnviosWebhook_Suscripcion` (`IdSuscripcion`, `Id`),
  CONSTRAINT `FK_EnviosWebhook_Suscripcion` FOREIGN KEY (`IdSuscripcion`) REFERENCES `SuscripcionesWebhook` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

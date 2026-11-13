-- Llaves de API por cliente (13/11/2026, fase 3 de la ruta Fis Fiber).
--
-- Un sistema del cliente consulta los reportes de Next con el encabezado
-- `X-Api-Key` en lugar de usuario y contraseña. Solo se guarda el SHA-256 de la
-- llave; la llave completa se muestra una sola vez, al crearla. La llave actúa
-- como un usuario Cliente (rol 6) de `IdCliente` y sus hijos, en las rutas de
-- solo lectura marcadas para aceptarla.
--
-- Solo crea una tabla nueva. Aplicar en la base `Next` ANTES de desplegar
-- NextAPI con esta versión. Se puede correr dos veces.

CREATE TABLE IF NOT EXISTS `LlavesApi` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(100) NOT NULL COMMENT 'Para qué sistema es',
  `Prefijo` char(8) NOT NULL COMMENT 'Parte visible de la llave, para buscarla y reconocerla',
  `Hash` char(64) NOT NULL COMMENT 'SHA-256 hex de la llave completa',
  `IdUsuario` bigint NOT NULL COMMENT 'Quién la creó; las consultas quedan a su nombre',
  `FechaCreacion` datetime NOT NULL,
  `FechaExpiracion` datetime NULL,
  `UltimoUso` datetime NULL,
  `FechaRevocacion` datetime NULL,
  `Estatus` tinyint NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_LlavesApi_Prefijo` (`Prefijo`),
  KEY `IX_LlavesApi_Cliente` (`IdCliente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

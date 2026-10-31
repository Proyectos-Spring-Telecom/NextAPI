-- Motor de activos, fase D (docs/motor-activos.md §3 y §6).
--
-- CorreccionesInstalacion: evidencia de cada corrección a una instalación que
-- no abre una versión nueva (p. ej. la fecha real de instalación). Sin llaves
-- foráneas, como MovimientosRecurso: es evidencia.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con fase D.

CREATE TABLE IF NOT EXISTS `CorreccionesInstalacion` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdInstalacion` bigint NOT NULL,
  `Fecha` datetime NOT NULL,
  `Campo` varchar(30) NOT NULL COMMENT 'VigenteDesde',
  `ValorAnterior` varchar(100) NULL,
  `ValorNuevo` varchar(100) NULL,
  `Motivo` varchar(500) NOT NULL,
  `IdUsuario` bigint NULL,
  `Origen` varchar(10) NOT NULL COMMENT 'api | sistema',
  PRIMARY KEY (`Id`),
  KEY `IX_CorrInst_Instalacion` (`IdInstalacion`, `Fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

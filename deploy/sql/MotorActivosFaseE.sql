-- Motor de activos, fase E (docs/motor-activos.md §7b): vigilancia de transmisión.
--
-- VigilanciaTransmisionTipo: horas sin transmitir antes de avisar, por tipo de
--   equipo. Un tipo sin fila usa 12 h (constante en el código).
-- EvaluacionesTransmision: una fila por día (hora de México). Se inserta antes
--   de evaluar: si ya existe, ese día ya se evaluó (varios reinicios o
--   instancias no duplican avisos).
-- AvisosSinTransmision: bandeja de monitoreo. Un aviso abierto o atendido por
--   instalación; se cierra solo cuando el equipo vuelve a transmitir o la
--   instalación se da de baja. Sin llaves foráneas: es evidencia.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con fase E.

CREATE TABLE IF NOT EXISTS `VigilanciaTransmisionTipo` (
  `IdTipoDispositivo` bigint NOT NULL,
  `HorasSinTransmitir` smallint NOT NULL,
  PRIMARY KEY (`IdTipoDispositivo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Relojes (7): 24 h. Los demás tipos: 12 h por defecto.
INSERT INTO `VigilanciaTransmisionTipo` (`IdTipoDispositivo`, `HorasSinTransmitir`) VALUES (7, 24)
ON DUPLICATE KEY UPDATE `HorasSinTransmitir` = VALUES(`HorasSinTransmitir`);

CREATE TABLE IF NOT EXISTS `EvaluacionesTransmision` (
  `Fecha` date NOT NULL COMMENT 'Día de la evaluación (hora de México)',
  `Inicio` datetime NOT NULL,
  `Fin` datetime NULL,
  `Avisos` int NOT NULL DEFAULT 0 COMMENT 'Avisos nuevos o actualizados',
  `Cerrados` int NOT NULL DEFAULT 0,
  `Origen` varchar(10) NOT NULL COMMENT 'sistema | api',
  `IdUsuario` bigint NULL,
  PRIMARY KEY (`Fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `AvisosSinTransmision` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdInstalacion` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `IdDispositivo` bigint NOT NULL,
  `IdTipoDispositivo` bigint NOT NULL,
  `IdSim` bigint NULL,
  `IdTelefonia` bigint NULL,
  `FechaEvaluacion` date NOT NULL COMMENT 'Última evaluación que lo actualizó',
  `FechaPrimeraEvaluacion` date NOT NULL COMMENT 'Evaluación que lo abrió: agrupa la posible falla de un proveedor',
  `UltimaTransmision` datetime NOT NULL,
  `HorasSinTransmitir` int NOT NULL,
  `Estatus` varchar(12) NOT NULL COMMENT 'abierto | atendido | cerrado',
  `Resultado` varchar(20) NULL COMMENT 'falla_equipo | taller | proveedor | cliente_avisado | otro',
  `Comentario` varchar(1000) NULL,
  `FechaRegreso` datetime NULL COMMENT 'Taller: la vigilancia se pausa hasta esta fecha',
  `IdUsuarioAtiende` bigint NULL,
  `FechaAtencion` datetime NULL,
  `FechaCierre` datetime NULL,
  `MotivoCierre` varchar(20) NULL COMMENT 'transmitio | baja | cambio',
  `FechaCreacion` datetime NOT NULL,
  `IdInstalacionVivo` bigint GENERATED ALWAYS AS (if((`Estatus` in ('abierto','atendido')),`IdInstalacion`,NULL)) STORED COMMENT 'Un aviso vivo por instalación',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_AvisosSinTx_Vivo` (`IdInstalacionVivo`),
  KEY `IX_AvisosSinTx_Estatus` (`Estatus`, `FechaEvaluacion`),
  KEY `IX_AvisosSinTx_Instalacion` (`IdInstalacion`, `Estatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

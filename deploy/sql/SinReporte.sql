-- Unidad sin reporte (18/11/2026, pedido de Monitoreo: alerta roja en el mapa).
--
-- SinReporteEpisodios: un episodio por cada vez que una instalación activa deja
--   de reportar más que su umbral (SinReporteScheduler, cada minuto). Se cierra
--   cuando vuelve a llegar una posición, la instalación se da de baja o cambia
--   de equipo. Con la tabla: un reinicio de NextAPI no repite ni pierde avisos,
--   `GET /monitoreo/list` trae `sinReporteDesde` y queda el historial.
--   `Abierto` = 1 mientras está abierto y NULL al cerrar: el índice único
--   (IdInstalacion, Abierto) impide dos episodios abiertos de la misma
--   instalación (MySQL permite varios NULL). Sin llaves foráneas: es evidencia.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con este cambio.

CREATE TABLE IF NOT EXISTS `SinReporteEpisodios` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdInstalacion` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `Imei` bigint NOT NULL,
  `UltimaFechaHora` datetime NOT NULL COMMENT 'FechaHora (equipo) de la última posición antes del silencio',
  `UltimoRegistro` datetime NOT NULL COMMENT 'FHRegistro (llegada) de esa posición',
  `UmbralMin` smallint NOT NULL,
  `Avisado` tinyint NOT NULL DEFAULT 1 COMMENT '0 = se registró sin alerta (ya estaba en falta o caída masiva)',
  `DetectadoEn` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CerradoEn` datetime NULL,
  `FechaHoraRecuperado` datetime NULL COMMENT 'FechaHora de la posición con la que volvió',
  `MotivoCierre` varchar(12) NULL COMMENT 'reporto | baja | cambio',
  `Abierto` tinyint NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_SinReporte_Abierto` (`IdInstalacion`, `Abierto`),
  KEY `IX_SinReporte_Instalacion` (`IdInstalacion`, `DetectadoEn`),
  KEY `IX_SinReporte_Abierto` (`Abierto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

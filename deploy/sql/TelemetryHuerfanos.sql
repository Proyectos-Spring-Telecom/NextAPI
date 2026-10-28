-- Equipos que transmiten sin alta en Next (docs: cambios-back-next §6 de springTrackCam).
-- Una fila por protocolo + equipo; el consumidor de la cola hace upsert en cada mensaje rechazado.
-- Aplicar una vez en la base `Next` antes de desplegar la rama.
CREATE TABLE IF NOT EXISTS `TelemetryHuerfanos` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Protocol` VARCHAR(16) NOT NULL COMMENT 'jt808 | jimi | axpro',
  `DeviceId` VARCHAR(32) NOT NULL COMMENT 'NumeroSerie (jt808), IMEI (jimi) o cuenta SIA (axpro)',
  `Motivo` VARCHAR(32) NOT NULL COMMENT 'no_registrado | sin_imei',
  `PrimeraVez` DATETIME NOT NULL,
  `UltimaVez` DATETIME NOT NULL,
  `Mensajes` BIGINT NOT NULL DEFAULT 1,
  `UltimoRoutingKey` VARCHAR(128) NULL,
  `UltimaLat` DOUBLE NULL,
  `UltimaLng` DOUBLE NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_TelemetryHuerfanos_ProtocolDevice` (`Protocol`, `DeviceId`),
  KEY `IX_TelemetryHuerfanos_UltimaVez` (`UltimaVez`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

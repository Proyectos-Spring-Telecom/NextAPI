-- Motor de activos, fase F (docs/motor-activos.md §8.5): parámetros de la
-- TrackCam por el canal de comandos (cola telemetry.commands.jt808).
--
-- Idempotente: se puede correr más de una vez. Aplicar en la base `Next`
-- después de MotorActivosFaseF.sql y antes de desplegar NextAPI con TrackCam.

-- Lo que el equipo devolvió al confirmar (p. ej. los parámetros leídos).
SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ComandosDispositivo' AND COLUMN_NAME = 'Resultado');
SET @ddl = IF(@existe = 0,
  'ALTER TABLE `ComandosDispositivo` ADD COLUMN `Resultado` json NULL COMMENT ''Lo que devolvió el equipo al confirmar'' AFTER `Detalle`',
  'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Parámetros JT808 de la cámara (1:1 con Dispositivos): lo que se pidió desde
-- Next y lo que la cámara tiene (su última lectura). Llaves = id hex (`0x0029`).
CREATE TABLE IF NOT EXISTS `ParametrosTrackCam` (
  `IdDispositivo` bigint NOT NULL,
  `Deseado` json NULL COMMENT 'Pedido desde Next (solo lo que se ha configurado)',
  `Leido` json NULL COMMENT 'Última lectura completa de la cámara (0x0104)',
  `FechaLectura` datetime NULL,
  `IdUsuario` bigint NULL,
  `FechaActualizacion` datetime NULL COMMENT 'Último cambio de Deseado',
  PRIMARY KEY (`IdDispositivo`),
  CONSTRAINT `FK_ParametrosTrackCam_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

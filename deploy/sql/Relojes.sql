-- Relojes FA100S: tipo de dispositivo RELOJ y su configuración (RelojConfig),
-- igual que TrackcamConfig para Trackcam. Docs: docs/contratos.md §14.2.
-- Aplicar una vez en la base `Next`.
--
-- Antes de aplicar, confirmar que el Id 7 está libre o ya es RELOJ:
--   SELECT * FROM CatTipoDispositivo WHERE Id = 7 OR Codigo = 'RELOJ';
-- Si el Id 7 lo usa otro tipo, el INSERT falla y no se aplica nada más:
-- avisar antes de seguir (el código usa EnumTipoDispositivo.RELOJ = 7).

INSERT INTO `CatTipoDispositivo` (`Id`, `Codigo`, `Nombre`, `Estatus`)
SELECT 7, 'RELOJ', 'Reloj', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `CatTipoDispositivo` WHERE `Codigo` = 'RELOJ');

CREATE TABLE IF NOT EXISTS `RelojConfig` (
  `IdDispositivo` BIGINT NOT NULL,
  `IdCliente` BIGINT NOT NULL,
  `IntervaloReporteSegundos` INT NULL DEFAULT 300 COMMENT 'UPLOAD: cada cuántos seg reporta posición en movimiento',
  `IntervaloGpsSegundos` INT NULL DEFAULT 600 COMMENT 'CR: cada cuántos seg el servidor enciende el GPS (0 = solo en SOS/caída)',
  `DeteccionCaida` TINYINT NOT NULL DEFAULT 1 COMMENT 'FALLDOWN x: 1 activa',
  `LlamadaPorCaida` TINYINT NOT NULL DEFAULT 1 COMMENT 'FALLDOWN y: 1 el reloj llama al detectar caída',
  `SensibilidadCaida` TINYINT NOT NULL DEFAULT 3 COMMENT 'LSSET n+6: 1 a 6, mayor = menos sensible',
  `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdDispositivo`),
  KEY `FK_RelojConfig_Dispositivo` (`IdCliente`, `IdDispositivo`),
  CONSTRAINT `FK_RelojConfig_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`)
    REFERENCES `Dispositivos` (`IdCliente`, `Id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Opcional: convertir a reloj un dispositivo que ya se dio de alta con otro tipo
-- (p. ej. Rastreador). Cambiar el IMEI y quitar los comentarios:
-- UPDATE `Dispositivos` SET `IdTipoDispositivo` = 7 WHERE `Imei` = 863269078504617;
-- INSERT IGNORE INTO `RelojConfig` (`IdDispositivo`, `IdCliente`)
--   SELECT `Id`, `IdCliente` FROM `Dispositivos` WHERE `Imei` = 863269078504617;

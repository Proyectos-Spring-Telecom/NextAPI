-- Órdenes de servicio, remediación (docs/remediacion-ordenes-servicio.md):
-- autorización ligada al vehículo, tope de códigos por orden, índices para las
-- pantallas de monitoreo y cursor de cambios (FechaActualizacion, Id).
-- Requiere OrdenesServicioEtapa3.sql. Idempotente.

DROP PROCEDURE IF EXISTS os_add_column;
DROP PROCEDURE IF EXISTS os_cambiar_indice;
DELIMITER $$
CREATE PROCEDURE os_add_column(IN tabla VARCHAR(64), IN columna VARCHAR(64), IN definicion TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tabla AND COLUMN_NAME = columna
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tabla, '` ADD COLUMN `', columna, '` ', definicion);
    PREPARE st FROM @ddl; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
-- Quita el índice si existe y lo crea con la definición nueva.
CREATE PROCEDURE os_cambiar_indice(IN tabla VARCHAR(64), IN indice VARCHAR(64), IN definicion TEXT)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tabla AND INDEX_NAME = indice
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tabla, '` DROP INDEX `', indice, '`');
    PREPARE st FROM @ddl; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
  SET @ddl = CONCAT('ALTER TABLE `', tabla, '` ADD ', definicion);
  PREPARE st FROM @ddl; EXECUTE st; DEALLOCATE PREPARE st;
END$$
DELIMITER ;

CALL os_add_column('OrdenesServicio', 'IdProductoAutorizacion', "BIGINT NULL COMMENT 'Vehículo por el que se pidió la autorización de desinstalar'");
CALL os_add_column('OrdenesServicio', 'CodigosEmitidos', "TINYINT NOT NULL DEFAULT 0 COMMENT 'Códigos de verificación emitidos (tope 5)'");

CALL os_cambiar_indice('OrdenesServicio', 'IX_OrdenesServicio_FechaActualizacion',
  'KEY `IX_OrdenesServicio_FechaActualizacion` (`FechaActualizacion`, `Id`)');
CALL os_cambiar_indice('OrdenesServicio', 'IX_OrdenesServicio_Estatus_CodigoExpira',
  'KEY `IX_OrdenesServicio_Estatus_CodigoExpira` (`Estatus`, `CodigoExpira`)');
CALL os_cambiar_indice('OrdenesServicio', 'IX_OrdenesServicio_Estatus_Autorizacion',
  'KEY `IX_OrdenesServicio_Estatus_Autorizacion` (`Estatus`, `Autorizacion`)');

DROP PROCEDURE os_add_column;
DROP PROCEDURE os_cambiar_indice;

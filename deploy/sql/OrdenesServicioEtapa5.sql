-- Órdenes de servicio: autorización para quitar un equipo de otro proveedor
-- (vehículo sin equipo activo en Next). Al cerrar el alta no se da de baja nada.
-- Requiere OrdenesServicioEtapa4.sql. Idempotente.

DROP PROCEDURE IF EXISTS os_add_column;
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
DELIMITER ;

CALL os_add_column('OrdenesServicio', 'EquipoTercero', "TINYINT NOT NULL DEFAULT 0 COMMENT '1 = la autorización es para quitar un equipo de otro proveedor; al cerrar no se da de baja nada en Next' AFTER `IdProductoAutorizacion`");

DROP PROCEDURE IF EXISTS os_add_column;

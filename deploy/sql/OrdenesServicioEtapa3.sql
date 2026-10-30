-- Órdenes de servicio, etapa 3 (docs/ordenes-servicio.md §13): pruebas
-- validadas por el operador (incluye la solicitud de paro de motor) y PDF de la
-- orden para enviarlo por correo o WhatsApp. Requiere OrdenesServicioEtapa2.sql.
-- Idempotente.

CREATE TABLE IF NOT EXISTS `OrdenServicioPruebas` (
  `IdOrdenServicio` BIGINT NOT NULL,
  `Clave` VARCHAR(40) NOT NULL COMMENT 'Clave de la sección pruebas (transmision, boton_panico, paro_motor)',
  `Estatus` VARCHAR(10) NOT NULL COMMENT 'solicitada | correcta | fallida',
  `FechaSolicitud` DATETIME NOT NULL,
  `IdUsuarioSolicito` BIGINT NOT NULL,
  `NotaTecnico` TEXT NULL,
  `FechaValidacion` DATETIME NULL,
  `IdUsuarioValido` BIGINT NULL COMMENT 'Operador que verificó la prueba',
  `NombreValido` VARCHAR(120) NULL,
  `NotaOperador` TEXT NULL,
  PRIMARY KEY (`IdOrdenServicio`, `Clave`),
  KEY `IX_OrdenServicioPruebas_Estatus` (`Estatus`, `FechaSolicitud`),
  CONSTRAINT `FK_OrdenServicioPruebas_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PDF generado de la orden (S3 privado); se regenera si la orden cambió.
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
CALL os_add_column('OrdenesServicio', 'RutaPdf', "VARCHAR(500) NULL COMMENT 'PDF de la orden en S3 privado'");
CALL os_add_column('OrdenesServicio', 'FechaPdf', "DATETIME NULL COMMENT 'Cuándo se generó el PDF'");
DROP PROCEDURE os_add_column;

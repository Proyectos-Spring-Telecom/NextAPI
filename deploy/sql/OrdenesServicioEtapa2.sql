-- Órdenes de servicio, etapa 2 (docs/ordenes-servicio.md §12): órdenes
-- programadas desde el CRM o por operación, código de verificación en
-- mantenimientos, autorización de desinstalación y estado no_cumplida con
-- motivos homologados. Requiere deploy/sql/OrdenesServicio.sql aplicado.
--
-- Idempotente: se puede correr más de una vez (MySQL 8 no tiene
-- ADD COLUMN IF NOT EXISTS; lo resuelven los procedimientos de abajo).

DROP PROCEDURE IF EXISTS os_add_column;
DROP PROCEDURE IF EXISTS os_add_index;
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
CREATE PROCEDURE os_add_index(IN tabla VARCHAR(64), IN indice VARCHAR(64), IN definicion TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tabla AND INDEX_NAME = indice
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tabla, '` ADD ', definicion);
    PREPARE st FROM @ddl; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
DELIMITER ;

-- Programada: la app pone ClaveApp al iniciar (UNIQUE admite varios NULL).
ALTER TABLE `OrdenesServicio`
  MODIFY `ClaveApp` CHAR(36) NULL COMMENT 'UUID de la app; NULL mientras está programada',
  MODIFY `Estatus` VARCHAR(12) NOT NULL DEFAULT 'borrador'
    COMMENT 'programada | borrador | cerrada | no_cumplida | cancelada',
  MODIFY `IdTecnico` BIGINT NOT NULL COMMENT 'Técnico asignado (al programar) o usuario del token (etapa 1)';

CALL os_add_column('OrdenesServicio', 'Origen', "VARCHAR(5) NULL COMMENT 'crm | next; NULL = la creó la app (etapa 1)'");
CALL os_add_column('OrdenesServicio', 'ReferenciaCrm', "VARCHAR(40) NULL COMMENT 'Referencia de la orden en el CRM (p. ej. OI-123)'");
CALL os_add_column('OrdenesServicio', 'Unidad', "SMALLINT NULL COMMENT '1..UnidadesTotal de la orden del CRM'");
CALL os_add_column('OrdenesServicio', 'UnidadesTotal', "SMALLINT NULL");
CALL os_add_column('OrdenesServicio', 'IdOrdenOrigen', "BIGINT NULL COMMENT 'Orden no cumplida/cancelada que ésta reprograma'");
CALL os_add_column('OrdenesServicio', 'TipoProgramado', "VARCHAR(20) NULL COMMENT 'Tipo programado; TipoServicio = lo que se hizo'");
CALL os_add_column('OrdenesServicio', 'IdInstalacionProgramada', "BIGINT NULL COMMENT 'Vehículo programado (mantenimientos)'");
CALL os_add_column('OrdenesServicio', 'Cita', "DATETIME NULL COMMENT 'Hora de Ciudad de México'");
CALL os_add_column('OrdenesServicio', 'CitaFin', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'IdUsuarioProgramo', "BIGINT NULL");
CALL os_add_column('OrdenesServicio', 'NombreProgramo', "VARCHAR(120) NULL COMMENT 'Usuario de Next o del CRM que programó'");
CALL os_add_column('OrdenesServicio', 'FechaInicio', "DATETIME NULL COMMENT 'El técnico la inició en campo'");
CALL os_add_column('OrdenesServicio', 'Codigo', "CHAR(6) NULL COMMENT 'Código vigente; se borra al validarlo o agotarlo'");
CALL os_add_column('OrdenesServicio', 'CodigoExpira', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'CodigoIntentos', "TINYINT NOT NULL DEFAULT 0");
CALL os_add_column('OrdenesServicio', 'IdUsuarioCodigo', "BIGINT NULL COMMENT 'Operador que vio el código'");
CALL os_add_column('OrdenesServicio', 'FechaCodigoVisto', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'FechaCodigoValidado', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'Autorizacion', "VARCHAR(10) NULL COMMENT 'pendiente | autorizada | rechazada'");
CALL os_add_column('OrdenesServicio', 'FechaSolicitudAutorizacion', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'IdUsuarioAutorizo', "BIGINT NULL");
CALL os_add_column('OrdenesServicio', 'NombreAutorizo', "VARCHAR(120) NULL");
CALL os_add_column('OrdenesServicio', 'FechaAutorizacion', "DATETIME NULL");
CALL os_add_column('OrdenesServicio', 'OrigenAutorizacion', "VARCHAR(5) NULL COMMENT 'next | crm'");
CALL os_add_column('OrdenesServicio', 'IdInstalacionRetirada', "BIGINT NULL COMMENT 'Instalación dada de baja al cerrar un alta autorizada'");
CALL os_add_column('OrdenesServicio', 'ClaveMotivo', "VARCHAR(40) NULL COMMENT '-> CatMotivosOrdenServicio'");
CALL os_add_column('OrdenesServicio', 'Cobrable', "TINYINT NULL COMMENT 'No cumplida/cancelada: 1 se paga al técnico'");

CALL os_add_index('OrdenesServicio', 'UQ_OrdenesServicio_ReferenciaCrm_Unidad',
  'UNIQUE KEY `UQ_OrdenesServicio_ReferenciaCrm_Unidad` (`ReferenciaCrm`, `Unidad`)');
CALL os_add_index('OrdenesServicio', 'IX_OrdenesServicio_Tecnico_Estatus_Cita',
  'KEY `IX_OrdenesServicio_Tecnico_Estatus_Cita` (`IdTecnico`, `Estatus`, `Cita`)');
CALL os_add_index('OrdenesServicio', 'IX_OrdenesServicio_FechaActualizacion',
  'KEY `IX_OrdenesServicio_FechaActualizacion` (`FechaActualizacion`)');

DROP PROCEDURE os_add_column;
DROP PROCEDURE os_add_index;

CREATE TABLE IF NOT EXISTS `CatMotivosOrdenServicio` (
  `Clave` VARCHAR(40) NOT NULL,
  `Nombre` VARCHAR(120) NOT NULL,
  `Resultado` VARCHAR(30) NOT NULL COMMENT 'no_cumplida, cancelada o ambos separados por coma',
  `Quien` VARCHAR(40) NOT NULL COMMENT 'tecnico, operacion, crm separados por coma',
  `Cobrable` TINYINT NOT NULL DEFAULT 0 COMMENT 'Por defecto; operación o el CRM lo ajustan',
  `Reprogramable` TINYINT NOT NULL DEFAULT 1,
  `RequiereObservaciones` TINYINT NOT NULL DEFAULT 0,
  `Orden` INT NOT NULL DEFAULT 0,
  `Estatus` TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`Clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Borrador acordado el 29/10/2026; operación y administración lo ajustan con UPDATE.
INSERT IGNORE INTO `CatMotivosOrdenServicio`
  (`Clave`, `Nombre`, `Resultado`, `Quien`, `Cobrable`, `Reprogramable`, `RequiereObservaciones`, `Orden`) VALUES
  ('cliente_ausente', 'Cliente ausente', 'no_cumplida', 'tecnico,operacion', 1, 1, 0, 1),
  ('vehiculo_no_disponible', 'Vehículo no disponible', 'no_cumplida', 'tecnico,operacion', 1, 1, 0, 2),
  ('condiciones_inadecuadas', 'Condiciones inadecuadas (lugar, clima)', 'no_cumplida', 'tecnico,operacion', 1, 1, 1, 3),
  ('danio_vehiculo', 'Daño en el vehículo', 'no_cumplida', 'tecnico,operacion', 1, 1, 1, 4),
  ('sin_autorizacion_desinstalacion', 'No se autorizó desinstalar el equipo existente', 'no_cumplida', 'tecnico,operacion,crm', 1, 0, 0, 5),
  ('falta_material', 'Falta de material (equipo, SIM, insumos)', 'no_cumplida', 'tecnico,operacion', 0, 1, 1, 6),
  ('sin_senal', 'Sin señal en el lugar', 'no_cumplida', 'tecnico,operacion', 1, 1, 0, 7),
  ('vehiculo_equivocado', 'El vehículo no corresponde a lo programado', 'no_cumplida', 'tecnico,operacion', 0, 1, 1, 8),
  ('cancelada_por_cliente', 'Cancelada por el cliente', 'cancelada', 'operacion,crm', 0, 1, 0, 9),
  ('reprogramada', 'Reprogramada', 'cancelada', 'operacion,crm', 0, 1, 0, 10),
  ('error_de_captura', 'Error de captura', 'cancelada', 'operacion,crm', 0, 0, 0, 11),
  ('duplicada', 'Orden duplicada', 'cancelada', 'operacion,crm', 0, 0, 0, 12),
  ('otro', 'Otro (especificar en observaciones)', 'no_cumplida,cancelada', 'tecnico,operacion,crm', 0, 1, 1, 13);

-- Foto del equipo encontrado al pedir autorización de desinstalarlo (§12.6).
INSERT IGNORE INTO `CatOrdenServicioOpciones` (`Seccion`, `Clave`, `Nombre`, `Obligatorio`, `Orden`) VALUES
  ('fotos', 'equipo_existente', 'Equipo existente en el vehículo', 0, 6);

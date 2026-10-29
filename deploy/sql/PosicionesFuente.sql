-- Origen y radio de la ubicación (cambios-back-next §14 de springTrackCam).
--
-- FuentePosicion: 0 GPS, 1 WiFi, 2 antena celular, 3 última posición válida;
-- NULL = el equipo no lo informa (cámaras, AVL). RadioM: radio en metros de
-- una ubicación aproximada (springGeoloc). Hoy solo los llenan los relojes.
--
-- ALGORITHM=INSTANT (MySQL 8): agrega la columna sin copiar la tabla.
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con estas columnas en
-- las entidades (TypeORM las selecciona y fallaría si no existen).
-- Reemplaza trg_pos_after_ins_ult (misma lógica de trg_pos_after_ins_ult_fecha.sql
-- + las dos columnas). Si se vuelve a aplicar el otro archivo, se pierden.

ALTER TABLE `Posiciones`
  ADD COLUMN `FuentePosicion` TINYINT NULL,
  ADD COLUMN `RadioM` SMALLINT UNSIGNED NULL,
  ALGORITHM = INSTANT;

ALTER TABLE `UltimaPosicion`
  ADD COLUMN `FuentePosicion` TINYINT NULL,
  ADD COLUMN `RadioM` SMALLINT UNSIGNED NULL,
  ALGORITHM = INSTANT;

DELIMITER $$

DROP TRIGGER IF EXISTS `trg_pos_after_ins_ult`$$

CREATE TRIGGER `trg_pos_after_ins_ult`
AFTER INSERT ON `Posiciones`
FOR EACH ROW
BEGIN
    INSERT INTO `UltimaPosicion`
        (`Imei`, `Lat`, `Lng`, `Estado`, `FechaHora`, `Velocidad`, `Direccion`,
         `Odometro`, `Ignicion`, `Alarma1`, `Alarma2`, `Energia`, `IdEvento`, `IdFoto`,
         `FHRegistro`, `Bateria`, `Alimentacion`, `GPS`, `GSM`, `Movimiento`, `Combustible`,
         `IdFoto1`, `IdFoto2`, `IdFoto3`,
         `IdVideo1`, `IdVideo2`, `IdVideo3`,
         `FuentePosicion`, `RadioM`)
    VALUES
        (NEW.`Imei`, NEW.`Lat`, NEW.`Lng`, NEW.`Estado`, NEW.`FechaHora`, NEW.`Velocidad`, NEW.`Direccion`,
         NEW.`Odometro`, NEW.`Ignicion`, NEW.`Alarma1`, NEW.`Alarma2`, NEW.`Energia`, NEW.`IdEvento`, NEW.`IdFoto`,
         NEW.`FHRegistro`, NEW.`Bateria`, NEW.`Alimentacion`, NEW.`GPS`, NEW.`GSM`, NEW.`Movimiento`, NEW.`Combustible`,
         NEW.`IdFoto1`, NEW.`IdFoto2`, NEW.`IdFoto3`,
         NEW.`IdVideo1`, NEW.`IdVideo2`, NEW.`IdVideo3`,
         NEW.`FuentePosicion`, NEW.`RadioM`)
    -- Solo si la posición es igual o más nueva: un reintento del outbox o un
    -- lote 0x0704 atrasado no debe pisar la última posición real.
    -- `FechaHora` va al final: MySQL evalúa las asignaciones en orden.
    ON DUPLICATE KEY UPDATE
        `Lat` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Lat`), `Lat`),
        `Lng` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Lng`), `Lng`),
        `Estado` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Estado`), `Estado`),
        `Velocidad` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Velocidad`), `Velocidad`),
        `Direccion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Direccion`), `Direccion`),
        `Odometro` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Odometro`), `Odometro`),
        `Ignicion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Ignicion`), `Ignicion`),
        `Alarma1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alarma1`), `Alarma1`),
        `Alarma2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alarma2`), `Alarma2`),
        `Energia` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Energia`), `Energia`),
        `IdEvento` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdEvento`), `IdEvento`),
        `IdFoto` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto`), `IdFoto`),
        `FHRegistro` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FHRegistro`), `FHRegistro`),
        `Bateria` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Bateria`), `Bateria`),
        `Alimentacion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alimentacion`), `Alimentacion`),
        `GPS` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`GPS`), `GPS`),
        `GSM` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`GSM`), `GSM`),
        `Movimiento` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Movimiento`), `Movimiento`),
        `Combustible` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Combustible`), `Combustible`),
        `IdFoto1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto1`), `IdFoto1`),
        `IdFoto2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto2`), `IdFoto2`),
        `IdFoto3` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto3`), `IdFoto3`),
        `IdVideo1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo1`), `IdVideo1`),
        `IdVideo2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo2`), `IdVideo2`),
        `IdVideo3` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo3`), `IdVideo3`),
        `FuentePosicion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FuentePosicion`), `FuentePosicion`),
        `RadioM` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`RadioM`), `RadioM`),
        `FechaHora` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FechaHora`), `FechaHora`);
END$$

DELIMITER ;

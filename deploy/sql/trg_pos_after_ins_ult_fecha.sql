-- UltimaPosicion: no pisar la última posición con una más vieja.
-- (cambios-back-next §9 de springTrackCam)
--
-- El trigger desplegado (trg_pos_after_ins_ult, 03-sep-2026) actualiza
-- UltimaPosicion sin comparar FechaHora: un reintento del outbox tras un corte,
-- un mensaje reinyectado desde la DLQ o un lote 0x0704 atrasado reemplazan la
-- posición actual por una vieja.
--
-- Solo reemplaza el trigger AFTER. NO toca trg_pos_before_ins (cálculo de
-- Estado/Ignicion), que en producción es más nuevo que el de
-- springTrackCam/docs/sql/trg_posiciones_ultima.sql: no aplicar ese archivo.
--
-- Aplicar en la base `Next`. El DROP + CREATE corre en segundos; una posición
-- que entre justo en ese instante actualiza UltimaPosicion con la siguiente.

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
         `IdVideo1`, `IdVideo2`, `IdVideo3`)
    VALUES
        (NEW.`Imei`, NEW.`Lat`, NEW.`Lng`, NEW.`Estado`, NEW.`FechaHora`, NEW.`Velocidad`, NEW.`Direccion`,
         NEW.`Odometro`, NEW.`Ignicion`, NEW.`Alarma1`, NEW.`Alarma2`, NEW.`Energia`, NEW.`IdEvento`, NEW.`IdFoto`,
         NEW.`FHRegistro`, NEW.`Bateria`, NEW.`Alimentacion`, NEW.`GPS`, NEW.`GSM`, NEW.`Movimiento`, NEW.`Combustible`,
         NEW.`IdFoto1`, NEW.`IdFoto2`, NEW.`IdFoto3`,
         NEW.`IdVideo1`, NEW.`IdVideo2`, NEW.`IdVideo3`)
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
        `FechaHora` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FechaHora`), `FechaHora`);
END$$

DELIMITER ;

-- Motor de activos, fase C (docs/motor-activos.md §3): varias instalaciones
-- activas por vehículo, una por clase de equipo.
--
-- - CatTipoDispositivo.Clase: AVL (rastreador, AVL, teléfono, TrackGas),
--   TRACKCAM, PANEL, RELOJ. Configurable: un tipo nuevo declara su clase.
-- - Instalaciones.Clase: la clase de su equipo (fija para la versión: un
--   cambio de equipo debe ser de la misma clase). ClaseActiva = Clase solo
--   mientras la instalación está activa; UNIQUE (IdCliente, IdProducto,
--   ClaseActiva) = un GPS, una TrackCam, un panel… por vehículo.
--
-- Una sola vez, en la base `Next`: compilar la fase C, aplicar este SQL y el
-- de geocercas, y reiniciar NextAPI enseguida. Si en ese lapso entró una
-- instalación, repetir después del reinicio el UPDATE de "Clase" (paso 3).
--
-- 1. Candado: si un vehículo ya tiene dos instalaciones activas de la misma
--    clase, el INSERT falla por duplicado y el script se detiene ANTES de
--    cambiar el esquema (el DDL de MySQL no se revierte).
DROP TEMPORARY TABLE IF EXISTS tmp_fase_c_chequeo;
CREATE TEMPORARY TABLE tmp_fase_c_chequeo (
  IdCliente bigint NOT NULL, IdProducto bigint NOT NULL, Clase varchar(12) NOT NULL,
  UNIQUE KEY (IdCliente, IdProducto, Clase)
);
INSERT INTO tmp_fase_c_chequeo (IdCliente, IdProducto, Clase)
SELECT i.IdCliente, i.IdProducto,
       CASE d.IdTipoDispositivo WHEN 2 THEN 'PANEL' WHEN 5 THEN 'TRACKCAM' WHEN 7 THEN 'RELOJ' ELSE 'AVL' END
  FROM Instalaciones i LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
 WHERE i.Estatus = 1;
DROP TEMPORARY TABLE tmp_fase_c_chequeo;

-- 2. Esquema.

ALTER TABLE `CatTipoDispositivo`
  ADD COLUMN `Clase` varchar(12) NOT NULL DEFAULT 'AVL' COMMENT 'AVL | TRACKCAM | PANEL | RELOJ: una instalación activa por clase y vehículo';

UPDATE `CatTipoDispositivo` SET `Clase` = 'PANEL' WHERE `Id` = 2;
UPDATE `CatTipoDispositivo` SET `Clase` = 'TRACKCAM' WHERE `Id` = 5;
UPDATE `CatTipoDispositivo` SET `Clase` = 'RELOJ' WHERE `Id` = 7;

ALTER TABLE `Instalaciones`
  ADD COLUMN `Clase` varchar(12) NOT NULL DEFAULT 'AVL' COMMENT 'Clase del equipo de esta versión',
  ADD COLUMN `ClaseActiva` varchar(12) GENERATED ALWAYS AS (if((`Estatus` = 1),`Clase`,NULL)) STORED;

-- 3. Clase de cada instalación (repetible). FechaActualizacion se conserva:
--    en una baja anterior al motor es el fin de su periodo.
UPDATE `Instalaciones` i
  JOIN `Dispositivos` d ON d.`Id` = i.`IdDispositivo`
  JOIN `CatTipoDispositivo` t ON t.`Id` = d.`IdTipoDispositivo`
   SET i.`Clase` = t.`Clase`, i.`FechaActualizacion` = i.`FechaActualizacion`
 WHERE i.`Clase` <> t.`Clase`;

ALTER TABLE `Instalaciones`
  ADD UNIQUE KEY `UQ_Inst_ProductoClaseActiva` (`IdCliente`, `IdProducto`, `ClaseActiva`);

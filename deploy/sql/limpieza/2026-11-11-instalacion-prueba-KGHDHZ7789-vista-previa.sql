-- Vista previa (SOLO LECTURA) de la limpieza del 11/11/2026 (Israel): la
-- instalación de prueba del vehículo KGHDHZ7789 (AND 01, BYD King) con el
-- equipo IMEI 222 (serie 0000…2222) y la SIM 8951234567891011 / 7771234567.
-- No borra nada: solo tablas temporales y SELECT.
--   mysql ... Next -e "SOURCE deploy/sql/limpieza/2026-11-11-instalacion-prueba-KGHDHZ7789-vista-previa.sql"
-- El borrado va aparte: 2026-11-11-instalacion-prueba-KGHDHZ7789-borrado.sql

DROP TEMPORARY TABLE IF EXISTS t_sel, t_disp, t_sim, t_prod, t_inst, t_hist, t_os, t_pos, t_inc, t_foto, t_video, t_mov, t_aviso, t_evpi;
-- (MySQL no deja usar una tabla temporal dos veces en la misma consulta: cada
-- una aparece una sola vez, con JOIN.)

-- Instalaciones señaladas (IMEI + placa)
CREATE TEMPORARY TABLE t_sel AS
SELECT i.Id AS IdInstalacion, i.IdCliente, d.Id AS IdDispositivo, d.Imei, d.NumeroSerie,
       i.IdSim, i.IdProducto, v.Placa
FROM Instalaciones i
JOIN Dispositivos d ON d.Id = i.IdDispositivo
JOIN Vehiculos v ON v.IdProducto = i.IdProducto
WHERE (d.Imei, v.Placa) IN (('222', 'KGHDHZ7789'));

CREATE TEMPORARY TABLE t_disp (Id BIGINT PRIMARY KEY, Imei VARCHAR(64)) AS SELECT DISTINCT IdDispositivo AS Id, Imei FROM t_sel;
-- La SIM 418 ("Reloj Rosa") NO se toca (Israel, 11/11): t_sim queda vacía, así
-- no se borra la SIM ni lo que cuelga solo de ella.
CREATE TEMPORARY TABLE t_sim (Id BIGINT PRIMARY KEY) AS SELECT DISTINCT IdSim AS Id FROM t_sel WHERE 1 = 0;
CREATE TEMPORARY TABLE t_prod (Id BIGINT PRIMARY KEY) AS SELECT DISTINCT IdProducto AS Id FROM t_sel;

-- Toda instalación (actual o pasada) que use esos equipos, SIM o vehículos
CREATE TEMPORARY TABLE t_inst (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT i.Id FROM Instalaciones i
LEFT JOIN t_disp d ON d.Id IN (i.IdDispositivo, i.DispositivoActivo)
LEFT JOIN t_sim s ON s.Id IN (i.IdSim, i.SimActivo)
LEFT JOIN t_prod p ON p.Id = i.IdProducto
WHERE d.Id IS NOT NULL OR s.Id IS NOT NULL OR p.Id IS NOT NULL;

CREATE TEMPORARY TABLE t_hist (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT h.Id FROM HistoricoInstalaciones h
LEFT JOIN t_disp d ON d.Id = h.IdDispositivo
LEFT JOIN t_sim s ON s.Id = h.IdSim
LEFT JOIN t_prod p ON p.Id = h.IdProducto
LEFT JOIN t_inst i ON i.Id = h.IdInstalacionOriginal
WHERE d.Id IS NOT NULL OR s.Id IS NOT NULL OR p.Id IS NOT NULL OR i.Id IS NOT NULL;

CREATE TEMPORARY TABLE t_os (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT o.Id FROM OrdenesServicio o
LEFT JOIN t_inst i ON i.Id IN (o.IdInstalacion, o.IdInstalacionResultado, o.IdInstalacionProgramada, o.IdInstalacionRetirada)
LEFT JOIN t_hist h ON h.Id = o.IdHistoricoInstalacion
LEFT JOIN t_prod p ON p.Id IN (o.IdProducto, o.IdProductoAutorizacion)
LEFT JOIN t_disp d ON d.Id = o.IdDispositivoNuevo
LEFT JOIN t_sim s ON s.Id = o.IdSimNuevo
WHERE i.Id IS NOT NULL OR h.Id IS NOT NULL OR p.Id IS NOT NULL OR d.Id IS NOT NULL OR s.Id IS NOT NULL;

CREATE TEMPORARY TABLE t_pos (Id BIGINT PRIMARY KEY) AS SELECT p.Id FROM Posiciones p JOIN t_disp d ON d.Imei = p.Imei;
CREATE TEMPORARY TABLE t_inc (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT x.Id FROM Incidentes x JOIN t_pos p ON p.Id IN (x.IdPosicion, x.IdPosicionOrigen);
CREATE TEMPORARY TABLE t_foto (Id BIGINT PRIMARY KEY) AS SELECT f.Id FROM Fotos f JOIN t_disp d ON d.Imei = f.Imei;
CREATE TEMPORARY TABLE t_video (Id BIGINT PRIMARY KEY) AS SELECT v.Id FROM Videos v JOIN t_disp d ON d.Imei = v.Imei;

CREATE TEMPORARY TABLE t_mov (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT m.Id FROM MovimientosRecurso m
LEFT JOIN t_os o ON o.Id = m.IdOrdenServicio
LEFT JOIN t_inst i ON i.Id = m.IdInstalacion
LEFT JOIN t_disp d ON m.TipoRecurso = 'dispositivo' AND d.Id = m.IdRecurso
LEFT JOIN t_sim s ON m.TipoRecurso = 'sim' AND s.Id = m.IdRecurso
LEFT JOIN t_prod p ON m.TipoRecurso = 'producto' AND p.Id = m.IdRecurso
WHERE o.Id IS NOT NULL OR i.Id IS NOT NULL OR d.Id IS NOT NULL OR s.Id IS NOT NULL OR p.Id IS NOT NULL;

CREATE TEMPORARY TABLE t_aviso (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT a.Id FROM AvisosSinTransmision a
LEFT JOIN t_inst i ON i.Id IN (a.IdInstalacion, a.IdInstalacionVivo)
LEFT JOIN t_disp d ON d.Id = a.IdDispositivo
LEFT JOIN t_sim s ON s.Id = a.IdSim
WHERE i.Id IS NOT NULL OR d.Id IS NOT NULL OR s.Id IS NOT NULL;

CREATE TEMPORARY TABLE t_evpi (Id BIGINT PRIMARY KEY) AS
SELECT DISTINCT e.Id FROM EventosPuntoInteres e
LEFT JOIN t_pos ps ON ps.Id = e.IdPosicion
LEFT JOIN t_inst i ON i.Id = e.IdInstalacion
LEFT JOIN t_prod p ON p.Id = e.IdProducto
WHERE ps.Id IS NOT NULL OR i.Id IS NOT NULL OR p.Id IS NOT NULL;

-- ===== Vista previa =====
SELECT 'Instalaciones señaladas (debe ser 1)' AS Que, IdInstalacion, IdCliente, Imei, NumeroSerie, IdSim, IdProducto, Placa FROM t_sel;
SELECT 'Instalaciones' AS Tabla, COUNT(*) AS Filas FROM t_inst
UNION ALL SELECT 'Dispositivos', COUNT(*) FROM t_disp
UNION ALL SELECT 'Sims', COUNT(*) FROM t_sim
UNION ALL SELECT 'Productos (vehículos)', COUNT(*) FROM t_prod
UNION ALL SELECT 'HistoricoInstalaciones', COUNT(*) FROM t_hist
UNION ALL SELECT 'OrdenesServicio', COUNT(*) FROM t_os
UNION ALL SELECT 'MovimientosRecurso', COUNT(*) FROM t_mov
UNION ALL SELECT 'AvisosSinTransmision', COUNT(*) FROM t_aviso
UNION ALL SELECT 'Posiciones', COUNT(*) FROM t_pos
UNION ALL SELECT 'Incidentes', COUNT(*) FROM t_inc
UNION ALL SELECT 'Fotos', COUNT(*) FROM t_foto
UNION ALL SELECT 'Videos', COUNT(*) FROM t_video;
-- Si aparece una instalación u orden que no es la de KGHDHZ7789, NO hacer COMMIT
SELECT 'Instalaciones que arrastra' AS Que, i.Id, i.IdCliente, i.IdDispositivo, i.IdSim, i.IdProducto, i.EstatusInstalacion
FROM Instalaciones i JOIN t_inst t ON t.Id = i.Id;
SELECT 'Órdenes de servicio que arrastra' AS Que, o.Id, o.Folio, o.TipoServicio, o.Estatus, o.IdCliente, o.Origen, o.ReferenciaCrm
FROM OrdenesServicio o JOIN t_os t ON t.Id = o.Id;
SELECT 'SIM que se conserva' AS Que, s.* FROM Sims s JOIN t_sel t ON t.IdSim = s.Id;
SELECT 'Movimientos que se borran' AS Que, m.* FROM MovimientosRecurso m JOIN t_mov t ON t.Id = m.Id;

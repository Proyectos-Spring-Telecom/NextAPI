-- Borrado FÍSICO de la instalación de prueba del vehículo KGHDHZ7789 (11/11/2026,
-- Israel): instalación, equipo IMEI 222, SIM, vehículo, posiciones, órdenes de
-- servicio desde que se agendó, historial y movimientos. Mismo alcance que
-- 2026-11-10-instalaciones-prueba.sql.
-- Correr SOLO después de revisar la vista previa
-- (2026-11-11-instalacion-prueba-KGHDHZ7789-vista-previa.sql). Termina en COMMIT.
--   mysql ... Next -e "SOURCE deploy/sql/limpieza/2026-11-11-instalacion-prueba-KGHDHZ7789-borrado.sql"

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
CREATE TEMPORARY TABLE t_sim (Id BIGINT PRIMARY KEY) AS SELECT DISTINCT IdSim AS Id FROM t_sel WHERE IdSim IS NOT NULL;
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

-- ===== Borrado =====
START TRANSACTION;

-- Incidentes y posiciones
DELETE s FROM SeguimientoIncidentes s JOIN t_inc t ON t.Id = s.IdIncidente;
DELETE x FROM Incidentes x JOIN t_inc t ON t.Id = x.Id;
DELETE e FROM EventosPuntoInteres e JOIN t_evpi t ON t.Id = e.Id;
DELETE u FROM UltimaPosicion u JOIN t_disp d ON d.Imei = u.Imei;
DELETE p FROM Posiciones p JOIN t_pos t ON t.Id = p.Id;
DELETE f FROM Fotos f JOIN t_foto t ON t.Id = f.Id;
DELETE v FROM Videos v JOIN t_video t ON t.Id = v.Id;

-- Órdenes de servicio (respuestas, archivos y pruebas se van en cascada)
DELETE m FROM MovimientosRecurso m JOIN t_mov t ON t.Id = m.Id;
DELETE o FROM OrdenesServicio o JOIN t_os t ON t.Id = o.Id;

-- Lo que cuelga de la instalación
DELETE u FROM UsuariosInstalaciones u JOIN t_inst t ON t.Id = u.IdInstalacion;
DELETE c FROM CorreccionesInstalacion c JOIN t_inst t ON t.Id = c.IdInstalacion;
DELETE a FROM AvisosSinTransmision a JOIN t_aviso t ON t.Id = a.Id;
DELETE c FROM ComandosDispositivo c JOIN t_disp t ON t.Id = c.IdDispositivo;

-- Instalación e historial (la instalación apunta al historial y el historial a sí mismo)
DELETE i FROM Instalaciones i JOIN t_inst t ON t.Id = i.Id;
UPDATE HistoricoInstalaciones h JOIN t_hist t ON t.Id = h.Id SET h.IdHistoricoInstalacion = NULL;
DELETE h FROM HistoricoInstalaciones h JOIN t_hist t ON t.Id = h.Id;

-- Recursos (configuración, geocercas y puntos de interés se van en cascada)
DELETE v FROM Vehiculos v JOIN t_prod t ON t.Id = v.IdProducto;
DELETE p FROM Productos p JOIN t_prod t ON t.Id = p.Id;
DELETE d FROM Dispositivos d JOIN t_disp t ON t.Id = d.Id;
DELETE s FROM Sims s JOIN t_sim t ON t.Id = s.Id;

SELECT (SELECT COUNT(*) FROM Instalaciones i JOIN t_inst t ON t.Id = i.Id) AS InstalacionesRestantes,
       (SELECT COUNT(*) FROM Dispositivos d JOIN t_disp t ON t.Id = d.Id) AS DispositivosRestantes,
       (SELECT COUNT(*) FROM Sims s JOIN t_sim t ON t.Id = s.Id) AS SimsRestantes,
       (SELECT COUNT(*) FROM Productos p JOIN t_prod t ON t.Id = p.Id) AS VehiculosRestantes;
COMMIT;

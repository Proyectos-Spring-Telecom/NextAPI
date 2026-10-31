-- Saneamiento de la fase B (docs/motor-activos.md §2 y §9). Revisado antes de
-- correr; aplicar en la base `Next` DESPUÉS de MotorActivosFaseB.sql.
--
-- 1. Equipo o SIM en estatus 2 (instalado) sin instalación activa: error de
--    datos anterior al motor → 3 (por revisar), con su movimiento.
-- 2. Equipo o SIM sin instalación activa → almacén (IdCliente NULL), con un
--    movimiento `traspaso` (Origen = sistema) que guarda el cliente que tenía.
--    Los instalados conservan el cliente de su instalación.
--
-- Idempotente: una segunda corrida no encuentra nada.

START TRANSACTION;

SET @f = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-06:00');

-- 1. Instalado sin instalación activa → por revisar.
INSERT INTO MovimientosRecurso (TipoRecurso, IdRecurso, Fecha, Accion, EstatusAnterior, EstatusNuevo, IdClienteAnterior, IdClienteNuevo, Motivo, Origen)
SELECT 'dispositivo', d.Id, @f, 'estatus', 2, 3, d.IdCliente, d.IdCliente,
       'Saneamiento fase B: estatus instalado sin instalación activa', 'sistema'
  FROM Dispositivos d
 WHERE d.Estatus = 2 AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.DispositivoActivo = d.Id)
UNION ALL
SELECT 'sim', s.Id, @f, 'estatus', 2, 3, s.IdCliente, s.IdCliente,
       'Saneamiento fase B: estatus instalada sin instalación activa', 'sistema'
  FROM Sims s
 WHERE s.Estatus = 2 AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.SimActivo = s.Id);

UPDATE Dispositivos d SET d.Estatus = 3
 WHERE d.Estatus = 2 AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.DispositivoActivo = d.Id);
UPDATE Sims s SET s.Estatus = 3
 WHERE s.Estatus = 2 AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.SimActivo = s.Id);

-- 2. Sin instalación activa → almacén.
INSERT INTO MovimientosRecurso (TipoRecurso, IdRecurso, Fecha, Accion, EstatusAnterior, EstatusNuevo, IdClienteAnterior, IdClienteNuevo, Motivo, Origen)
SELECT 'dispositivo', d.Id, @f, 'traspaso', d.Estatus, d.Estatus, d.IdCliente, NULL,
       'Saneamiento fase B: al almacén (sin instalación activa)', 'sistema'
  FROM Dispositivos d
 WHERE d.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.DispositivoActivo = d.Id)
UNION ALL
SELECT 'sim', s.Id, @f, 'traspaso', s.Estatus, s.Estatus, s.IdCliente, NULL,
       'Saneamiento fase B: al almacén (sin instalación activa)', 'sistema'
  FROM Sims s
 WHERE s.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.SimActivo = s.Id);

SELECT
  (SELECT COUNT(*) FROM Dispositivos d WHERE d.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.DispositivoActivo = d.Id)) AS dispositivos_al_almacen,
  (SELECT COUNT(*) FROM Sims s WHERE s.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.SimActivo = s.Id)) AS sims_al_almacen;

UPDATE Dispositivos d SET d.IdCliente = NULL
 WHERE d.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.DispositivoActivo = d.Id);
UPDATE Sims s SET s.IdCliente = NULL
 WHERE s.IdCliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Instalaciones i WHERE i.SimActivo = s.Id);

COMMIT;

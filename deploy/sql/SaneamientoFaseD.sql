-- Saneamiento de la fase D (docs/motor-activos.md §9 y §14). Revisado antes de
-- correr; aplicar en la base `Next` DESPUÉS de MotorActivosFaseD.sql y ANTES de
-- desplegar el código de la fase D (si no, el recorte oculta recorridos reales).
--
-- 1. Archiva las bajas anteriores al motor (instalación inactiva sin baja
--    archivada): su periodo termina en FechaActualizacion, la última escritura
--    de la fila (CURRENT_TIMESTAMP de MySQL, en hora de México: time_zone -06:00).
--    Va primero: cualquier escritura posterior a la fila movería esa fecha.
--
-- 2. Corrige `VigenteDesde` de las instalaciones dadas de alta en Next después
--    de que su equipo ya transmitía: la fecha pasa a la primera posición del
--    equipo. Solo cuando es seguro atribuirle esas posiciones:
--      - no tiene versión anterior (IdHistoricoInstalacion NULL);
--      - su dispositivo y su SIM no tienen otro periodo (ni histórico ni otra instalación);
--      - la primera posición es de a lo más 2 días antes del alta (más atrás
--        puede ser almacén o banco de pruebas: se revisa a mano).
--    Las que no cumplen se listan al final y se corrigen con
--    PATCH /instalaciones/:id/vigente-desde.
--    Cada corrección queda en CorreccionesInstalacion con Origen = 'sistema'.
--
-- Idempotente: una segunda corrida no encuentra nada que archivar ni corregir.

START TRANSACTION;

INSERT INTO HistoricoInstalaciones
  (IdCliente, IdProducto, IdDispositivo, IdSim, EstatusInstalacion, IdInstalacionOriginal,
   VigenteDesde, VigenteHasta, IdHistoricoInstalacion, IdUsuario, Accion, Comentario, FHArchivado)
SELECT i.IdCliente, i.IdProducto, i.IdDispositivo, i.IdSim, i.EstatusInstalacion, i.Id,
       i.VigenteDesde, GREATEST(i.FechaActualizacion, i.VigenteDesde), i.IdHistoricoInstalacion, NULL, 'Baja',
       'Saneamiento fase D: baja anterior al motor, periodo hasta la última actualización de la instalación',
       GREATEST(i.FechaActualizacion, i.VigenteDesde)
  FROM Instalaciones i
 WHERE i.Estatus <> 1
   AND NOT EXISTS (SELECT 1 FROM HistoricoInstalaciones h
                    WHERE h.IdInstalacionOriginal = i.Id AND h.Accion = 'Baja'
                      AND h.Id > COALESCE(i.IdHistoricoInstalacion, 0));

SELECT ROW_COUNT() AS bajas_archivadas;

DROP TEMPORARY TABLE IF EXISTS tmp_fase_d;
CREATE TEMPORARY TABLE tmp_fase_d AS
SELECT i.Id, i.VigenteDesde AS anterior, pri.primera AS nueva
  FROM Instalaciones i
  JOIN Dispositivos d ON d.Id = i.IdDispositivo
  JOIN (SELECT Imei, MIN(FechaHora) AS primera FROM Posiciones GROUP BY Imei) pri ON pri.Imei = d.Imei
 WHERE i.Estatus = 1
   AND pri.primera < i.VigenteDesde
   AND pri.primera >= i.VigenteDesde - INTERVAL 2 DAY
   AND i.IdHistoricoInstalacion IS NULL
   AND NOT EXISTS (SELECT 1 FROM HistoricoInstalaciones h WHERE h.IdDispositivo = i.IdDispositivo)
   AND NOT EXISTS (SELECT 1 FROM Instalaciones o WHERE o.IdDispositivo = i.IdDispositivo AND o.Id <> i.Id)
   AND (i.IdSim IS NULL OR (
         NOT EXISTS (SELECT 1 FROM HistoricoInstalaciones h WHERE h.IdSim = i.IdSim)
     AND NOT EXISTS (SELECT 1 FROM Instalaciones o WHERE o.IdSim = i.IdSim AND o.Id <> i.Id)));

INSERT INTO CorreccionesInstalacion (IdInstalacion, Fecha, Campo, ValorAnterior, ValorNuevo, Motivo, IdUsuario, Origen)
SELECT Id, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-06:00'), 'VigenteDesde',
       DATE_FORMAT(anterior, '%Y-%m-%d %H:%i:%s'), DATE_FORMAT(nueva, '%Y-%m-%d %H:%i:%s'),
       'Saneamiento fase D: alta en Next posterior a la primera transmisión del equipo', NULL, 'sistema'
  FROM tmp_fase_d;

UPDATE Instalaciones i JOIN tmp_fase_d t ON t.Id = i.Id
   SET i.VigenteDesde = t.nueva
 WHERE i.VigenteDesde = t.anterior;

SELECT COUNT(*) AS corregidas, MAX(TIMESTAMPDIFF(MINUTE, nueva, anterior)) AS max_min_atras FROM tmp_fase_d;
SELECT Id, anterior, nueva, TIMESTAMPDIFF(MINUTE, nueva, anterior) AS min_atras
  FROM tmp_fase_d WHERE TIMESTAMPDIFF(MINUTE, nueva, anterior) > 30 ORDER BY min_atras DESC;

COMMIT;

-- Pendientes de revisar a mano (activas con posiciones antes de su VigenteDesde
-- que no se corrigieron aquí): se corrigen con PATCH /instalaciones/:id/vigente-desde.
SELECT i.Id, i.IdCliente, i.VigenteDesde, i.IdHistoricoInstalacion,
       (SELECT MIN(p.FechaHora) FROM Posiciones p WHERE p.Imei = d.Imei) AS primera
  FROM Instalaciones i JOIN Dispositivos d ON d.Id = i.IdDispositivo
 WHERE i.Estatus = 1
   AND EXISTS (SELECT 1 FROM Posiciones p WHERE p.Imei = d.Imei AND p.FechaHora < i.VigenteDesde);

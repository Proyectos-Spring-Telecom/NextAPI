-- Tiempo detenido por minuto (10/11/2026, reporte de Monitoreo; fallo-tiempo-detenido.md).
--
-- DetenidoDesde: inicio del conteo de la última posición (AVL, TrackCam,
-- TrackGas en Estado 0/4/5/6); NULL en movimiento o alerta. La ingesta lo
-- escribe después de cada INSERT en Posiciones; TiempoDetenidoScheduler sube
-- cada minuto UltimaPosicion.Estado a 4/5/6 sin esperar la siguiente posición.
--
-- Aplicar en la base `Next` ANTES de desplegar NextAPI con esta columna en la
-- entidad (TypeORM la selecciona y fallaría si no existe). UltimaPosicion tiene
-- una fila por equipo: el índice se crea en segundos.

ALTER TABLE `UltimaPosicion`
  ADD COLUMN `DetenidoDesde` DATETIME NULL;

ALTER TABLE `UltimaPosicion`
  ADD KEY `IX_UltimaPosicion_DetenidoDesde` (`DetenidoDesde`);

-- Relleno para las unidades que ya están detenidas (sin esto, una que no
-- vuelva a reportar, como LORD 021, nunca avanzaría): cuenta desde su último
-- reporte. Es conservador (nunca pinta de más); el siguiente reporte lo
-- corrige con el inicio real del tramo. Tipos 3 AVL, 5 TrackCam, 6 TrackGas.
UPDATE `UltimaPosicion` u
  JOIN `Dispositivos` d ON d.`Imei` = u.`Imei`
   SET u.`DetenidoDesde` = u.`FechaHora`
 WHERE u.`DetenidoDesde` IS NULL
   AND u.`Estado` IN (0, 4, 5, 6)
   AND IFNULL(u.`Velocidad`, 0) <= 5
   AND d.`IdTipoDispositivo` IN (3, 5, 6);

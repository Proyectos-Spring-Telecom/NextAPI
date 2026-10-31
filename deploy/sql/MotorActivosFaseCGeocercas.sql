-- Motor de activos, fase C: geocercas por vehículo (docs/motor-activos.md §3).
--
-- La geocerca cuelga del vehículo (producto), no de la versión de la
-- instalación: un cambio de equipo o una segunda instalación en el mismo
-- vehículo (GPS + TrackCam) ya no la pierde. Antes la FK a Instalaciones era
-- ON DELETE CASCADE y el cambio de componente borra la fila vieja: la geocerca
-- se perdía.
--
-- IdProducto NULL = geocerca del cliente sin vehículo: no se evalúa (misma
-- regla que tenía IdInstalacion NULL).
--
-- Una sola vez, en la base `Next`. Quita la columna IdInstalacion que usa el
-- código anterior: compilar la fase C primero, aplicar y reiniciar enseguida.

ALTER TABLE `Geocercas`
  ADD COLUMN `IdProducto` bigint NULL COMMENT 'Vehículo al que aplica; NULL = no se evalúa' AFTER `IdCliente`;

-- El vehículo de la instalación a la que estaba ligada (mismo cliente).
UPDATE `Geocercas` g
  JOIN `Instalaciones` i ON i.Id = g.IdInstalacion AND i.IdCliente = g.IdCliente
   SET g.IdProducto = i.IdProducto, g.FechaActualizacion = g.FechaActualizacion;

-- Las geocercas de versiones ya borradas no existen: la FK era ON DELETE
-- CASCADE y el código también las borraba (la bitácora guardó solo id y
-- nombre, no la figura). Esas pérdidas pasadas no se recuperan.

ALTER TABLE `Geocercas` DROP FOREIGN KEY `FK_Geocercas_Instalaciones`;
ALTER TABLE `Geocercas`
  DROP KEY `FK_Geocercas_Instalaciones`,
  DROP KEY `IX_Geocercas_IdInstalacion`,
  DROP COLUMN `IdInstalacion`,
  ADD KEY `IX_Geocercas_Cliente_Producto` (`IdCliente`, `IdProducto`),
  ADD CONSTRAINT `FK_Geocercas_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE;

-- Geocercas del cliente para varios vehículos (decisión del 5/11/2026).
--
-- La geocerca es del cliente (catálogo): monitoreo la crea para un cliente y,
-- si la crea un acceso del cliente, queda en su cliente. Una geocerca aplica a
-- uno o varios vehículos y un vehículo tiene una o varias geocercas: la liga
-- pasa a `ProductosGeocerca`. Un vehículo puede usar las geocercas de su
-- cliente y de sus clientes padre. La alerta de salida (Estado 8) se evalúa
-- solo con las geocercas ligadas al vehículo.
--
-- `UsuariosGeocerca` deja de usarse (no daba visibilidad ni avisos); la tabla
-- se queda por ahora. `Geocercas.IdProducto` se copia aquí y el código nuevo
-- ya no la lee ni la escribe; se quita después, cuando el cambio esté estable.
--
-- Una sola vez, en la base `Next`. Se puede aplicar antes de reiniciar: el
-- código anterior no usa la tabla nueva.

CREATE TABLE IF NOT EXISTS `ProductosGeocerca` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdProducto` bigint NOT NULL COMMENT 'Vehículo que evalúa la geocerca',
  `IdGeocerca` bigint NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_ProductoGeocerca` (`IdProducto`, `IdGeocerca`),
  KEY `IX_ProductoGeocerca_Geocerca` (`IdGeocerca`, `Estatus`),
  CONSTRAINT `FK_ProductoGeocerca_Producto` FOREIGN KEY (`IdProducto`) REFERENCES `Productos` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductoGeocerca_Geocerca` FOREIGN KEY (`IdGeocerca`) REFERENCES `Geocercas` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- El vehículo que ya tenía cada geocerca.
INSERT IGNORE INTO `ProductosGeocerca` (`IdProducto`, `IdGeocerca`, `Estatus`)
SELECT g.IdProducto, g.Id, 1 FROM `Geocercas` g WHERE g.IdProducto IS NOT NULL;

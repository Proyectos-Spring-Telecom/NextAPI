-- Motor de activos, fase B (docs/motor-activos.md §2): equipo y SIM sin
-- cliente en almacén.
--
-- - Dispositivos.IdCliente y Sims.IdCliente admiten NULL: NULL = almacén
--   general; con cliente y sin instalar = reservado a ese cliente. Al instalar
--   toman el cliente de la instalación; al salir regresan al almacén (NULL).
-- - Instalaciones: el amarre compuesto (cliente, equipo) solo vale mientras la
--   instalación está activa (columnas generadas DispositivoActivo / SimActivo);
--   una instalación dada de baja apunta al equipo solo por su Id.
-- - HistoricoInstalaciones: FK simples a Dispositivos, Sims y Productos; su
--   IdCliente es el cliente de ese periodo (evidencia), no un amarre.
-- - RelojConfig, TrackcamConfig y PanelAlarma: la configuración es del equipo;
--   se quita su IdCliente (su llave ya es IdDispositivo).
--
-- Una sola vez, en la base `Next`. Quita columnas que usa el código anterior:
-- compilar la fase B primero, aplicar este SQL y reiniciar NextAPI enseguida.
-- Después, deploy/sql/SaneamientoFaseB.sql.

-- Histórico: amarres simples.
ALTER TABLE `HistoricoInstalaciones`
  DROP FOREIGN KEY `FK_HistInst_Dispositivo`,
  DROP FOREIGN KEY `FK_HistInst_Sim`,
  DROP FOREIGN KEY `FK_HistInst_Producto`;
ALTER TABLE `HistoricoInstalaciones`
  ADD KEY `IX_HistInst_Dispositivo` (`IdDispositivo`),
  ADD KEY `IX_HistInst_Sim` (`IdSim`),
  ADD KEY `IX_HistInst_Producto` (`IdProducto`),
  ADD CONSTRAINT `FK_HistInst_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`),
  ADD CONSTRAINT `FK_HistInst_Sim` FOREIGN KEY (`IdSim`) REFERENCES `Sims` (`Id`),
  ADD CONSTRAINT `FK_HistInst_Producto` FOREIGN KEY (`IdProducto`) REFERENCES `Productos` (`Id`);

-- Instalaciones: compuesto solo para la versión activa.
ALTER TABLE `Instalaciones`
  DROP FOREIGN KEY `FK_Inst_Dispositivo`,
  DROP FOREIGN KEY `FK_Inst_Sim`;
ALTER TABLE `Instalaciones`
  ADD KEY `IX_Inst_Dispositivo` (`IdDispositivo`),
  ADD KEY `IX_Inst_Sim` (`IdSim`),
  ADD CONSTRAINT `FK_Inst_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`),
  ADD CONSTRAINT `FK_Inst_Sim` FOREIGN KEY (`IdSim`) REFERENCES `Sims` (`Id`),
  ADD CONSTRAINT `FK_Inst_DispositivoActivo` FOREIGN KEY (`IdCliente`, `DispositivoActivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`),
  ADD CONSTRAINT `FK_Inst_SimActivo` FOREIGN KEY (`IdCliente`, `SimActivo`) REFERENCES `Sims` (`IdCliente`, `Id`);

-- Configuración del equipo: sin cliente.
ALTER TABLE `RelojConfig` DROP FOREIGN KEY `FK_RelojConfig_Dispositivo`;
ALTER TABLE `RelojConfig`
  DROP KEY `FK_RelojConfig_Dispositivo`,
  DROP COLUMN `IdCliente`,
  ADD CONSTRAINT `FK_RelojConfig_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`) ON DELETE CASCADE;

ALTER TABLE `TrackcamConfig` DROP FOREIGN KEY `FK_TrackcamConfig_Dispositivo`;
ALTER TABLE `TrackcamConfig`
  DROP KEY `FK_TrackcamConfig_Dispositivo`,
  DROP COLUMN `IdCliente`,
  ADD CONSTRAINT `FK_TrackcamConfig_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`) ON DELETE CASCADE;

ALTER TABLE `PanelAlarma` DROP FOREIGN KEY `FK_PanelAlarma_Dispositivo`;
ALTER TABLE `PanelAlarma`
  DROP KEY `FK_PanelAlarma_Dispositivo`,
  DROP COLUMN `IdCliente`,
  ADD CONSTRAINT `FK_PanelAlarma_Dispositivo` FOREIGN KEY (`IdDispositivo`) REFERENCES `Dispositivos` (`Id`) ON DELETE CASCADE;

-- Equipo y SIM en almacén: sin cliente.
ALTER TABLE `Dispositivos` MODIFY `IdCliente` bigint NULL COMMENT 'NULL = almacén; con cliente sin instalar = reservado; instalado = el de la instalación';
ALTER TABLE `Sims` MODIFY `IdCliente` bigint NULL COMMENT 'NULL = almacén; con cliente sin instalar = reservada; instalada = el de la instalación';

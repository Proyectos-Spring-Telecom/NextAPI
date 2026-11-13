-- Resumen diario por unidad y contadores del vehículo (13/11/2026, fase 2 de
-- la ruta Fis Fiber: odómetro y horas de motor acumulados).
--
-- ResumenDiarioUnidad: una fila por instalación y día completo (00:00–23:59),
-- con el mismo cálculo que POST /reportes/jornada. La llena ResumenDiarioScheduler
-- (el día anterior y, poco a poco, los días faltantes hacia atrás); el día en
-- curso nunca se guarda, se calcula al consultar.
--
-- ContadoresVehiculo: kilometraje y horas de motor capturados (lectura del
-- tablero). Sin fila, el odómetro parte de Vehiculos.KM en la fecha de alta
-- del producto. Tabla aparte para no tocar Vehiculos.
--
-- Solo crea tablas nuevas: no toca ninguna existente. Aplicar en la base
-- `Next` ANTES de desplegar NextAPI con esta versión (el scheduler las usa al
-- arrancar). Se puede correr dos veces.

CREATE TABLE IF NOT EXISTS `ResumenDiarioUnidad` (
  `IdInstalacion`        INT           NOT NULL,
  `Fecha`                DATE          NOT NULL,
  `IdProducto`           INT           NULL,
  `PrimerEncendido`      DATETIME      NULL,
  `UltimoApagado`        DATETIME      NULL,
  `PrimerMovimiento`     DATETIME      NULL,
  `UltimoMovimiento`     DATETIME      NULL,
  `Km`                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `HorasMotor`           DECIMAL(6,2)  NOT NULL DEFAULT 0,
  `MovimientoMin`        DECIMAL(6,1)  NOT NULL DEFAULT 0,
  `DetenidoEncendidoMin` DECIMAL(6,1)  NOT NULL DEFAULT 0,
  `ApagadoMin`           DECIMAL(6,1)  NOT NULL DEFAULT 0,
  `DetenidoMin`          DECIMAL(6,1)  NOT NULL DEFAULT 0,
  `SinDatosMin`          DECIMAL(6,1)  NOT NULL DEFAULT 0,
  `VelocidadMax`         SMALLINT      NULL,
  `CiclosMotor`          SMALLINT      NOT NULL DEFAULT 0,
  `ExcesosVelocidad`     SMALLINT      NOT NULL DEFAULT 0,
  `Posiciones`           INT           NOT NULL DEFAULT 0,
  `ReportaIgnicion`      TINYINT(1)    NOT NULL DEFAULT 0,
  `FechaCalculo`         DATETIME      NOT NULL,
  PRIMARY KEY (`IdInstalacion`, `Fecha`),
  KEY `IX_ResumenDiarioUnidad_Producto` (`IdProducto`, `Fecha`),
  KEY `IX_ResumenDiarioUnidad_Fecha` (`Fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ContadoresVehiculo` (
  `IdProducto`          INT           NOT NULL,
  `KmBase`              DECIMAL(12,2) NULL,
  `FechaKmBase`         DATETIME      NULL,
  `HorasMotorBase`      DECIMAL(10,2) NULL,
  `FechaHorasMotorBase` DATETIME      NULL,
  `IdUsuario`           INT           NULL,
  `FechaActualizacion`  DATETIME      NOT NULL,
  PRIMARY KEY (`IdProducto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

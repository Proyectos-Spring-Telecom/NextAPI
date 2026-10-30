-- Esquema de la base Next de producción (solo estructura, sin datos), 2026-10-29.
-- mysqldump --no-data --routines --triggers; sin cláusulas DEFINER.
-- Lo usa la batería de punta a punta (entorno.ts). Regenerar cuando cambie producción.

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: Next
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Activos`
--

DROP TABLE IF EXISTS `Activos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Activos` (
  `IdProducto` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(250) DEFAULT NULL,
  `Descripcion` varchar(500) DEFAULT NULL,
  `Foto` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`IdProducto`),
  KEY `FK_Activos_Producto` (`IdCliente`,`IdProducto`),
  CONSTRAINT `FK_Activos_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `AsignacionSoluciones`
--

DROP TABLE IF EXISTS `AsignacionSoluciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AsignacionSoluciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdUsuario` bigint NOT NULL,
  `IdSolucion` bigint NOT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_AsigSoluc_IdUsuario_IdSolucion` (`IdUsuario`,`IdSolucion`),
  KEY `IX_AsigSoluc_IdUsua_IdSoluc` (`IdUsuario`,`IdSolucion`),
  KEY `IX_AsigSoluc_IdUsua_Estatus` (`IdUsuario`,`Estatus`),
  KEY `IX_AsigSoluc_IdSoluc_Estatus` (`IdSolucion`,`Estatus`),
  KEY `IX_AsigSoluc_IdUsuario` (`IdUsuario`),
  KEY `IX_AsigSoluc_IdSolucion` (`IdSolucion`),
  CONSTRAINT `FK_AsignSoluc_Soluciones` FOREIGN KEY (`IdSolucion`) REFERENCES `Soluciones` (`Id`),
  CONSTRAINT `FK_AsignSoluc_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Bitacora`
--

DROP TABLE IF EXISTS `Bitacora`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Bitacora` (
  `Accion` varchar(45) DEFAULT NULL,
  `Descripcion` varchar(250) DEFAULT NULL,
  `Estatus` varchar(20) DEFAULT NULL,
  `Error` varchar(1000) DEFAULT NULL,
  `FechaCreacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdModulo` bigint DEFAULT NULL,
  `IdUsuario` bigint NOT NULL,
  `Modulo` varchar(100) DEFAULT NULL,
  `Query` json DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `FK_Bitacora_Modulos` (`IdModulo`),
  KEY `FK_Bitacora_Usuarios` (`IdUsuario`),
  CONSTRAINT `FK_Bitacora_Modulos` FOREIGN KEY (`IdModulo`) REFERENCES `Modulos` (`Id`),
  CONSTRAINT `FK_Bitacora_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3911 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatEstatusInstalacion`
--

DROP TABLE IF EXISTS `CatEstatusInstalacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatEstatusInstalacion` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Codigo` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatEstatusInstalacion_Codigo` (`Codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatEventos`
--

DROP TABLE IF EXISTS `CatEventos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatEventos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatMarcas`
--

DROP TABLE IF EXISTS `CatMarcas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatMarcas` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `IdProducto` bigint NOT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatMarcas_Nombre` (`Nombre`),
  KEY `FK_CatMarcas_CatProductos` (`IdProducto`),
  CONSTRAINT `FK_CatMarcas_CatProductos` FOREIGN KEY (`IdProducto`) REFERENCES `CatProductos` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatModelos`
--

DROP TABLE IF EXISTS `CatModelos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatModelos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `IdCatMarcas` bigint NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `FK_CatModelos_CatMarcas` (`IdCatMarcas`),
  CONSTRAINT `FK_CatModelos_CatMarcas` FOREIGN KEY (`IdCatMarcas`) REFERENCES `CatMarcas` (`Id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatMotivosOrdenServicio`
--

DROP TABLE IF EXISTS `CatMotivosOrdenServicio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatMotivosOrdenServicio` (
  `Clave` varchar(40) NOT NULL,
  `Nombre` varchar(120) NOT NULL,
  `Resultado` varchar(30) NOT NULL COMMENT 'no_cumplida, cancelada o ambos separados por coma',
  `Quien` varchar(40) NOT NULL COMMENT 'tecnico, operacion, crm separados por coma',
  `Cobrable` tinyint NOT NULL DEFAULT '0' COMMENT 'Por defecto; operación o el CRM lo ajustan',
  `Reprogramable` tinyint NOT NULL DEFAULT '1',
  `RequiereObservaciones` tinyint NOT NULL DEFAULT '0',
  `Orden` int NOT NULL DEFAULT '0',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatOrdenServicioOpciones`
--

DROP TABLE IF EXISTS `CatOrdenServicioOpciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatOrdenServicioOpciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Seccion` varchar(32) NOT NULL COMMENT 'vehiculo_cuenta_con | funcionamiento_vehiculo | fallas_equipo | pruebas | fotos | firmas',
  `Clave` varchar(40) NOT NULL,
  `Nombre` varchar(120) NOT NULL,
  `Obligatorio` tinyint NOT NULL DEFAULT '0' COMMENT 'Solo fotos/firmas: debe existir el archivo para cerrar',
  `Orden` int NOT NULL DEFAULT '0',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatOrdenServicioOpciones_SeccionClave` (`Seccion`,`Clave`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatPlanesTelefonia`
--

DROP TABLE IF EXISTS `CatPlanesTelefonia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatPlanesTelefonia` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(500) DEFAULT NULL,
  `IdTelefonia` bigint NOT NULL,
  `Datos` varchar(100) DEFAULT '0' COMMENT 'Cantidad de datos incluidos en MB (NULL = ilimitado)',
  `SMSIncluidos` varchar(100) DEFAULT '0' COMMENT 'Cantidad de SMS incluidos',
  `VozIncluidos` varchar(100) DEFAULT '0' COMMENT 'Minutos de voz incluidos',
  `CostoMensual` varchar(100) DEFAULT NULL COMMENT 'Costo mensual en MXN',
  `FechaInicioVigencia` date DEFAULT NULL COMMENT 'Desde cuándo está disponible el plan',
  `FechaFinVigencia` date DEFAULT NULL COMMENT 'Hasta cuándo está disponible (NULL = sin fecha fin)',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `FK_CatPlanesTelefonia_Telefonia` (`IdTelefonia`),
  KEY `IX_CatPlanesTelefonia_Estatus` (`Estatus`),
  CONSTRAINT `FK_CatPlanesTelefonia_Telefonia` FOREIGN KEY (`IdTelefonia`) REFERENCES `CatTelefonia` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatProductos`
--

DROP TABLE IF EXISTS `CatProductos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatProductos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `FechaCreacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatTelefonia`
--

DROP TABLE IF EXISTS `CatTelefonia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatTelefonia` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `NombreTelefonia` varchar(100) NOT NULL,
  `NombreAsesor` varchar(200) DEFAULT NULL,
  `NumeroAsesor` varchar(20) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatTelefonia_Nombre` (`NombreTelefonia`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatTipoCombustible`
--

DROP TABLE IF EXISTS `CatTipoCombustible`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatTipoCombustible` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatTipoDispositivo`
--

DROP TABLE IF EXISTS `CatTipoDispositivo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatTipoDispositivo` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Codigo` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatTipoDispositivo_Codigo` (`Codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CatTipoProducto`
--

DROP TABLE IF EXISTS `CatTipoProducto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatTipoProducto` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Codigo` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatTipoProducto_Codigo` (`Codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Clientes`
--

DROP TABLE IF EXISTS `Clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Clientes` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdPadre` bigint DEFAULT NULL,
  `ActaConstitutiva` varchar(500) DEFAULT NULL,
  `ApellidoMaterno` varchar(100) DEFAULT NULL,
  `ApellidoPaterno` varchar(100) DEFAULT NULL,
  `CP` varchar(5) DEFAULT NULL,
  `Calle` varchar(100) DEFAULT NULL,
  `Colonia` varchar(100) DEFAULT NULL,
  `ComprobanteDomicilio` varchar(500) DEFAULT NULL,
  `ConstanciaSituacionFiscal` varchar(500) DEFAULT NULL,
  `Correo` varchar(100) DEFAULT NULL,
  `CorreoEncargado` varchar(100) DEFAULT NULL,
  `EntreCalles` varchar(255) DEFAULT NULL,
  `Estado` varchar(50) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Logotipo` varchar(500) DEFAULT NULL,
  `Municipio` varchar(50) DEFAULT NULL,
  `Nombre` varchar(100) DEFAULT NULL,
  `NombreEncargado` varchar(255) DEFAULT NULL,
  `NumeroExterior` varchar(20) DEFAULT NULL,
  `NumeroInterior` varchar(20) DEFAULT NULL,
  `RFC` varchar(16) NOT NULL,
  `SitioWeb` varchar(100) DEFAULT NULL,
  `Telefono` varchar(14) DEFAULT NULL,
  `TelefonoEncargado` varchar(14) DEFAULT NULL,
  `TipoPersona` tinyint NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Clientes_RFC` (`RFC`),
  KEY `IX_Clientes_IdPadre` (`IdPadre`),
  CONSTRAINT `FK_Clientes_Padre` FOREIGN KEY (`IdPadre`) REFERENCES `Clientes` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CodigoAutenticacion`
--

DROP TABLE IF EXISTS `CodigoAutenticacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CodigoAutenticacion` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdUsuario` bigint NOT NULL,
  `Codigo` varchar(6) NOT NULL,
  `Tipo` tinyint unsigned NOT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaExpiracion` datetime NOT NULL,
  `Usado` tinyint NOT NULL DEFAULT '0',
  `FechaUso` datetime DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `IntentosFallidos` int DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IDX_CodigoAutenticacion_IdUsuario` (`IdUsuario`),
  CONSTRAINT `FK_CodigoAutenticacion_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Dispositivos`
--

DROP TABLE IF EXISTS `Dispositivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Dispositivos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdTipoDispositivo` bigint NOT NULL,
  `NumeroSerie` varchar(100) NOT NULL,
  `Imei` bigint DEFAULT NULL COMMENT 'IMEI del equipo (clave de telemetría)',
  `Eco` varchar(50) DEFAULT NULL COMMENT 'Número económico',
  `Camara` tinyint DEFAULT '0',
  `IdMarca` bigint DEFAULT NULL,
  `IdModelo` bigint DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Dispositivos_Cliente_Id` (`IdCliente`,`Id`),
  UNIQUE KEY `UQ_Dispositivos_NumeroSerie` (`NumeroSerie`),
  UNIQUE KEY `UQ_Dispositivos_Imei` (`Imei`),
  KEY `IX_Dispositivos_Cliente_Tipo` (`IdCliente`,`IdTipoDispositivo`,`Estatus`),
  KEY `FK_Dispositivos_CatMarcas_idx` (`IdMarca`),
  KEY `FK_Dispositivos_CatModelos_idx` (`IdModelo`),
  KEY `FK_Dispositivos_Tipo` (`IdTipoDispositivo`),
  CONSTRAINT `FK_Dispositivos_CatMarcas` FOREIGN KEY (`IdMarca`) REFERENCES `CatMarcas` (`Id`),
  CONSTRAINT `FK_Dispositivos_CatModelos` FOREIGN KEY (`IdModelo`) REFERENCES `CatModelos` (`Id`),
  CONSTRAINT `FK_Dispositivos_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Dispositivos_Tipo` FOREIGN KEY (`IdTipoDispositivo`) REFERENCES `CatTipoDispositivo` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000439 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `EventoAlarma`
--

DROP TABLE IF EXISTS `EventoAlarma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EventoAlarma` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdPanel` bigint DEFAULT NULL COMMENT 'FK a PanelAlarma; NULL si llegó #acct desconocido',
  `IdCliente` bigint DEFAULT NULL COMMENT 'Desnormalizado para filtro multi-tenant',
  `CodigoSia` varchar(8) NOT NULL COMMENT 'BA, OP, TA, AT, YT, etc.',
  `TipoEvento` varchar(40) NOT NULL COMMENT 'intrusion, arm, disarm, tamper, ac_loss, low_battery, zone, restore',
  `EsRestauracion` tinyint NOT NULL DEFAULT '0',
  `Zona` int DEFAULT NULL,
  `Particion` int DEFAULT NULL,
  `CodigoUsuario` int DEFAULT NULL COMMENT 'Código de usuario que disparó el evento (eventos de armado/desarmado)',
  `NombreDispositivo` varchar(100) DEFAULT NULL COMMENT 'Nombre del sensor/zona/dispositivo (campo S del frame, ej. Cocina, Sirena)',
  `Severidad` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '1=Info, 2=Advertencia, 3=Crítica',
  `Secuencia` varchar(8) DEFAULT NULL COMMENT 'SEQ del frame DC-09',
  `FrameCrudo` text NOT NULL,
  `DataDescifrada` text,
  `IpOrigen` varchar(45) DEFAULT NULL,
  `RecibidoEn` datetime NOT NULL COMMENT 'Timestamp de recepción en el server',
  `TimestampPanel` varchar(40) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  KEY `IX_EventoAlarma_IdCliente_RecibidoEn` (`IdCliente`,`RecibidoEn`),
  KEY `IX_EventoAlarma_IdPanel_RecibidoEn` (`IdPanel`,`RecibidoEn`),
  KEY `IX_EventoAlarma_CodigoSia` (`CodigoSia`),
  KEY `IX_EventoAlarma_RecibidoEn` (`RecibidoEn`),
  KEY `FK_EventoAlarma_Panel` (`IdPanel`),
  KEY `FK_EventoAlarma_Clientes` (`IdCliente`),
  KEY `IX_EventoAlarma_NombreDispositivo` (`NombreDispositivo`),
  CONSTRAINT `FK_EventoAlarma_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_EventoAlarma_Panel` FOREIGN KEY (`IdPanel`) REFERENCES `PanelAlarma` (`IdDispositivo`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4278 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Fotos`
--

DROP TABLE IF EXISTS `Fotos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Fotos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Imei` bigint DEFAULT NULL,
  `IdFoto` bigint DEFAULT NULL,
  `Ruta` varchar(500) DEFAULT NULL,
  `RutaServidor` varchar(500) DEFAULT NULL COMMENT 'Ruta física del archivo en el servidor (disco)',
  `FechaHora` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3713 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GatewayIngestLog`
--

DROP TABLE IF EXISTS `GatewayIngestLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GatewayIngestLog` (
  `IdempotencyKey` char(64) NOT NULL,
  `Tipo` varchar(16) NOT NULL,
  `IdEventoAlarma` bigint DEFAULT NULL,
  `RecibidoEn` datetime NOT NULL,
  `FHRegistro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdempotencyKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Geocercas`
--

DROP TABLE IF EXISTS `Geocercas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Geocercas` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdInstalacion` bigint DEFAULT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(500) DEFAULT NULL,
  `Geocerca` json NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_Geocercas_IdCliente` (`IdCliente`),
  KEY `IX_Geocercas_IdInstalacion` (`IdInstalacion`),
  KEY `IX_Geocercas_Cliente_Estatus` (`IdCliente`,`Estatus`),
  KEY `FK_Geocercas_Instalaciones` (`IdCliente`,`IdInstalacion`),
  CONSTRAINT `FK_Geocercas_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Geocercas_Instalaciones` FOREIGN KEY (`IdCliente`, `IdInstalacion`) REFERENCES `Instalaciones` (`IdCliente`, `Id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `HistoricoInstalaciones`
--

DROP TABLE IF EXISTS `HistoricoInstalaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `HistoricoInstalaciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdProducto` bigint NOT NULL,
  `IdDispositivo` bigint DEFAULT NULL,
  `IdSim` bigint DEFAULT NULL,
  `EstatusInstalacion` bigint NOT NULL,
  `IdInstalacionOriginal` bigint DEFAULT NULL COMMENT 'Id que tenía la instalación dada de baja (trazabilidad)',
  `VigenteDesde` datetime DEFAULT NULL COMMENT 'Inicio de vigencia de esta versión archivada',
  `VigenteHasta` datetime DEFAULT NULL COMMENT 'Fin de vigencia (instante en que se archivó esta versión)',
  `IdHistoricoInstalacion` bigint DEFAULT NULL COMMENT 'Eslabón anterior de la cadena (auto-FK). NULL = origen',
  `IdUsuario` bigint DEFAULT NULL COMMENT 'Usuario que realizó esta acción (NULL = sistema)',
  `Accion` varchar(50) NOT NULL COMMENT 'Ej: Alta, Cambio de dispositivo, Cambio de producto, Baja, Suspensión',
  `Comentario` text COMMENT 'Motivo del cambio / observaciones del técnico',
  `FHArchivado` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Momento en que esta versión se archivó',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_HistInst_Cliente_Id` (`IdCliente`,`Id`),
  KEY `IX_HistInst_Cliente_Original` (`IdCliente`,`IdInstalacionOriginal`),
  KEY `IX_HistInst_Cliente_Dispositivo` (`IdCliente`,`IdDispositivo`),
  KEY `IX_HistInst_FHArchivado` (`FHArchivado`),
  KEY `FK_HistInst_Eslabon_idx` (`IdHistoricoInstalacion`),
  KEY `FK_HistInst_Producto_idx` (`IdCliente`,`IdProducto`),
  KEY `FK_HistInst_Sim_idx` (`IdCliente`,`IdSim`),
  KEY `FK_HistInst_Estatus` (`EstatusInstalacion`),
  KEY `IX_HistInst_VigenteDesde` (`VigenteDesde`),
  KEY `FK_HistInst_Usuario_idx` (`IdUsuario`),
  CONSTRAINT `FK_HistInst_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_HistInst_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`),
  CONSTRAINT `FK_HistInst_Eslabon` FOREIGN KEY (`IdHistoricoInstalacion`) REFERENCES `HistoricoInstalaciones` (`Id`),
  CONSTRAINT `FK_HistInst_Estatus` FOREIGN KEY (`EstatusInstalacion`) REFERENCES `CatEstatusInstalacion` (`Id`),
  CONSTRAINT `FK_HistInst_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`),
  CONSTRAINT `FK_HistInst_Sim` FOREIGN KEY (`IdCliente`, `IdSim`) REFERENCES `Sims` (`IdCliente`, `Id`),
  CONSTRAINT `FK_HistInst_Usuario` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Incidentes`
--

DROP TABLE IF EXISTS `Incidentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Incidentes` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `TipoOrigen` tinyint NOT NULL DEFAULT '1',
  `IdPosicion` int DEFAULT NULL,
  `IdPosicionOrigen` int DEFAULT NULL,
  `IdEventoAlarma` bigint DEFAULT NULL,
  `IdEventoAlarmaOrigen` bigint DEFAULT NULL,
  `DatosOrigen` json NOT NULL,
  `IdUsuario` bigint DEFAULT NULL,
  `Descripcion` varchar(1000) DEFAULT NULL,
  `FechaInicio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaCierre` datetime DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_Incidentes_IdCliente` (`IdCliente`),
  KEY `IX_Incidentes_IdPosicion` (`IdPosicion`),
  KEY `IX_Incidentes_IdUsuario` (`IdUsuario`),
  KEY `IX_Incidentes_Cliente_Estatus` (`IdCliente`,`Estatus`),
  KEY `IX_Incidentes_IdEventoAlarma` (`IdEventoAlarma`),
  KEY `IX_Incidentes_TipoOrigen` (`TipoOrigen`),
  CONSTRAINT `FK_Incidentes_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Incidentes_EventoAlarma` FOREIGN KEY (`IdEventoAlarma`) REFERENCES `EventoAlarma` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_Incidentes_Posiciones` FOREIGN KEY (`IdPosicion`) REFERENCES `Posiciones` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_Incidentes_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Inmuebles`
--

DROP TABLE IF EXISTS `Inmuebles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Inmuebles` (
  `IdProducto` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `Inmueble` varchar(400) DEFAULT NULL,
  `DireccionFiscal` text,
  `NombreRepresentante` varchar(250) DEFAULT NULL,
  `TelefonoRepresentante` varchar(10) DEFAULT NULL,
  `CorreoRepresentante` varchar(100) DEFAULT NULL,
  `Lat` double DEFAULT NULL,
  `Lng` double DEFAULT NULL,
  `Foto` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`IdProducto`),
  KEY `FK_Inmuebles_Producto` (`IdCliente`,`IdProducto`),
  CONSTRAINT `FK_Inmuebles_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Instalaciones`
--

DROP TABLE IF EXISTS `Instalaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Instalaciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdProducto` bigint NOT NULL COMMENT 'OBLIGATORIO',
  `IdDispositivo` bigint DEFAULT NULL COMMENT 'OPCIONAL',
  `IdSim` bigint DEFAULT NULL COMMENT 'OPCIONAL',
  `EstatusInstalacion` bigint NOT NULL DEFAULT '1',
  `IdHistoricoInstalacion` bigint DEFAULT NULL COMMENT 'Último histórico de esta instalación (NULL = alta sin historia)',
  `VigenteDesde` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Desde cuándo está vigente esta versión de la instalación',
  `IdUsuario` bigint DEFAULT NULL COMMENT 'Usuario que realizó la última acción (NULL = sistema)',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `DispositivoActivo` bigint GENERATED ALWAYS AS (if((`Estatus` = 1),`IdDispositivo`,NULL)) STORED,
  `SimActivo` bigint GENERATED ALWAYS AS (if((`Estatus` = 1),`IdSim`,NULL)) STORED,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Instalaciones_Cliente_Id` (`IdCliente`,`Id`),
  UNIQUE KEY `UQ_Inst_DispositivoActivo` (`IdCliente`,`DispositivoActivo`),
  UNIQUE KEY `UQ_Inst_SimActivo` (`IdCliente`,`SimActivo`),
  KEY `IX_Instalaciones_Cliente_Estatus` (`IdCliente`,`EstatusInstalacion`),
  KEY `FK_Inst_Producto_idx` (`IdCliente`,`IdProducto`),
  KEY `FK_Inst_Dispositivo_idx` (`IdCliente`,`IdDispositivo`),
  KEY `FK_Inst_Sim_idx` (`IdCliente`,`IdSim`),
  KEY `FK_Inst_Estatus` (`EstatusInstalacion`),
  KEY `FK_Inst_Historico_idx` (`IdCliente`,`IdHistoricoInstalacion`),
  KEY `FK_Inst_Usuario_idx` (`IdUsuario`),
  CONSTRAINT `FK_Inst_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Inst_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`),
  CONSTRAINT `FK_Inst_Estatus` FOREIGN KEY (`EstatusInstalacion`) REFERENCES `CatEstatusInstalacion` (`Id`),
  CONSTRAINT `FK_Inst_Historico` FOREIGN KEY (`IdCliente`, `IdHistoricoInstalacion`) REFERENCES `HistoricoInstalaciones` (`IdCliente`, `Id`),
  CONSTRAINT `FK_Inst_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`),
  CONSTRAINT `FK_Inst_Sim` FOREIGN KEY (`IdCliente`, `IdSim`) REFERENCES `Sims` (`IdCliente`, `Id`),
  CONSTRAINT `FK_Inst_Usuario` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000440 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Licencias`
--

DROP TABLE IF EXISTS `Licencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Licencias` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdOperador` bigint NOT NULL COMMENT 'FK → Operadores.Id',
  `NumeroLicencia` varchar(50) NOT NULL COMMENT 'Número oficial de la licencia',
  `IdTipoLicencia` bigint NOT NULL COMMENT 'FK → CatTipoLicencia.Id (Tipo A, B, C, D, E, Federal)',
  `IdCategoriaLicencia` bigint NOT NULL COMMENT 'FK → CatCategoriaLicencia.Id (Permanente, Temporal)',
  `FechaExpedicion` date NOT NULL,
  `FechaVencimiento` date NOT NULL,
  `Licencia` varchar(500) NOT NULL COMMENT 'URL S3 del documento escaneado',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Licencias_IdOperador_IdTipoLicencia` (`IdOperador`,`IdTipoLicencia`),
  UNIQUE KEY `UQ_Licencias_NumeroLicencia` (`NumeroLicencia`),
  KEY `IX_Licencias_IdOperador` (`IdOperador`),
  CONSTRAINT `FK_Licencias_Operadores` FOREIGN KEY (`IdOperador`) REFERENCES `Operadores` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Modulos`
--

DROP TABLE IF EXISTS `Modulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Modulos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `IdSolucion` bigint DEFAULT NULL,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Modulos_Nombre` (`Nombre`,`IdSolucion`),
  KEY `FK_Modulos_Soluciones` (`IdSolucion`),
  CONSTRAINT `FK_Modulos_Soluciones` FOREIGN KEY (`IdSolucion`) REFERENCES `Soluciones` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `NumerosEmergenciaCliente`
--

DROP TABLE IF EXISTS `NumerosEmergenciaCliente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `NumerosEmergenciaCliente` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(100) DEFAULT NULL,
  `Telefono` varchar(14) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Prioridad` int NOT NULL DEFAULT '1',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_NumerosEmergenciaCliente_IdCliente` (`IdCliente`),
  KEY `IX_NumerosEmergenciaCliente_Cliente_Estatus` (`IdCliente`,`Estatus`),
  CONSTRAINT `FK_NumerosEmergenciaCliente_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Operadores`
--

DROP TABLE IF EXISTS `Operadores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Operadores` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL COMMENT 'FK → Clientes.Id (multitenancy, directo para evitar JOINs)',
  `IdUsuario` bigint NOT NULL COMMENT 'FK → Usuarios.Id (el operador es un usuario)',
  `FechaNacimiento` date NOT NULL,
  `CURP` varchar(18) NOT NULL COMMENT 'Clave Única de Registro de Población',
  `NSS` varchar(11) NOT NULL COMMENT 'Número de Seguro Social',
  `ContactoEmergenciaNombre` varchar(200) NOT NULL,
  `ContactoEmergenciaTelefono` varchar(14) NOT NULL,
  `Identificacion` varchar(500) NOT NULL COMMENT 'INE / Pasaporte',
  `Foto` varchar(500) DEFAULT NULL COMMENT 'Fotografía del operador',
  `ComprobanteDomicilio` varchar(500) DEFAULT NULL,
  `CertificadoMedico` varchar(500) DEFAULT NULL,
  `AntecedentesNoPenales` varchar(500) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Operadores_IdUsuario` (`IdUsuario`),
  UNIQUE KEY `UQ_Operadores_IdCliente_CURP` (`IdCliente`,`CURP`),
  UNIQUE KEY `UQ_Operadores_IdCliente_NSS` (`IdCliente`,`NSS`),
  KEY `IX_Operadores_IdCliente_IdEstatusOperador` (`IdCliente`),
  CONSTRAINT `FK_Operadores_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Operadores_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrdenServicioArchivos`
--

DROP TABLE IF EXISTS `OrdenServicioArchivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrdenServicioArchivos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdOrdenServicio` bigint NOT NULL,
  `Clave` varchar(40) NOT NULL COMMENT 'Clave de fotos/firmas en CatOrdenServicioOpciones',
  `Ruta` varchar(500) NOT NULL COMMENT 'URL privada en S3; se lee con URL firmada',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_OrdenServicioArchivos_OrdenClave` (`IdOrdenServicio`,`Clave`),
  CONSTRAINT `FK_OrdenServicioArchivos_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrdenServicioPruebas`
--

DROP TABLE IF EXISTS `OrdenServicioPruebas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrdenServicioPruebas` (
  `IdOrdenServicio` bigint NOT NULL,
  `Clave` varchar(40) NOT NULL COMMENT 'Clave de la sección pruebas (transmision, boton_panico, paro_motor)',
  `Estatus` varchar(10) NOT NULL COMMENT 'solicitada | correcta | fallida',
  `FechaSolicitud` datetime NOT NULL,
  `IdUsuarioSolicito` bigint NOT NULL,
  `NotaTecnico` text,
  `FechaValidacion` datetime DEFAULT NULL,
  `IdUsuarioValido` bigint DEFAULT NULL COMMENT 'Operador que verificó la prueba',
  `NombreValido` varchar(120) DEFAULT NULL,
  `NotaOperador` text,
  PRIMARY KEY (`IdOrdenServicio`,`Clave`),
  KEY `IX_OrdenServicioPruebas_Estatus` (`Estatus`,`FechaSolicitud`),
  CONSTRAINT `FK_OrdenServicioPruebas_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrdenServicioRespuestas`
--

DROP TABLE IF EXISTS `OrdenServicioRespuestas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrdenServicioRespuestas` (
  `IdOrdenServicio` bigint NOT NULL,
  `Seccion` varchar(32) NOT NULL,
  `Clave` varchar(40) NOT NULL,
  `Valor` tinyint NOT NULL COMMENT '1 = sí / correcto; 0 = no. Se guardan todas, también las apagadas',
  PRIMARY KEY (`IdOrdenServicio`,`Seccion`,`Clave`),
  CONSTRAINT `FK_OrdenServicioRespuestas_Orden` FOREIGN KEY (`IdOrdenServicio`) REFERENCES `OrdenesServicio` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrdenesServicio`
--

DROP TABLE IF EXISTS `OrdenesServicio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrdenesServicio` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Folio` varchar(20) DEFAULT NULL COMMENT 'OS-000001, lo asigna el servidor al crear',
  `ClaveApp` char(36) DEFAULT NULL COMMENT 'UUID de la app; NULL mientras está programada',
  `TipoServicio` varchar(20) NOT NULL COMMENT 'instalacion | revision | c_sim | c_equipo | desinstalacion',
  `Estatus` varchar(12) NOT NULL DEFAULT 'borrador' COMMENT 'programada | borrador | cerrada | no_cumplida | cancelada',
  `IdCliente` bigint NOT NULL,
  `IdInstalacion` bigint DEFAULT NULL COMMENT 'Instalación atendida (NULL en alta hasta cerrar)',
  `IdInstalacionResultado` bigint DEFAULT NULL COMMENT 'Instalación vigente tras cerrar (alta o cambio crean Id nuevo)',
  `IdHistoricoInstalacion` bigint DEFAULT NULL COMMENT 'Versión archivada por un cambio de equipo/SIM',
  `IdProducto` bigint DEFAULT NULL COMMENT 'Vehículo/activo; estable entre versiones de la instalación',
  `IdDispositivoNuevo` bigint DEFAULT NULL COMMENT 'Alta o cambio de equipo',
  `IdSimNuevo` bigint DEFAULT NULL COMMENT 'Alta o cambio de SIM',
  `EstatusSalienteAnterior` tinyint DEFAULT NULL COMMENT 'Cambio de equipo/SIM: estatus del que sale (EnumEstatusProductoDispositivo)',
  `EstatusInstalacionBaja` tinyint DEFAULT NULL COMMENT 'Desinstalación: 0 inactiva | 5 inservible',
  `IdTecnico` bigint NOT NULL COMMENT 'Técnico asignado (al programar) o usuario del token (etapa 1)',
  `IdMonitorista` bigint DEFAULT NULL COMMENT 'Usuario con rol 4/5',
  `FechaCaptura` datetime DEFAULT NULL COMMENT 'Reloj del dispositivo al registrar (hora de Ciudad de México)',
  `Lat` double DEFAULT NULL,
  `Lng` double DEFAULT NULL,
  `Observaciones` text,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCierre` datetime DEFAULT NULL,
  `IdUsuarioCierre` bigint DEFAULT NULL,
  `Origen` varchar(5) DEFAULT NULL COMMENT 'crm | next; NULL = la creó la app (etapa 1)',
  `ReferenciaCrm` varchar(40) DEFAULT NULL COMMENT 'Referencia de la orden en el CRM (p. ej. OI-123)',
  `Unidad` smallint DEFAULT NULL COMMENT '1..UnidadesTotal de la orden del CRM',
  `UnidadesTotal` smallint DEFAULT NULL,
  `IdOrdenOrigen` bigint DEFAULT NULL COMMENT 'Orden no cumplida/cancelada que ésta reprograma',
  `TipoProgramado` varchar(20) DEFAULT NULL COMMENT 'Tipo programado; TipoServicio = lo que se hizo',
  `IdInstalacionProgramada` bigint DEFAULT NULL COMMENT 'Vehículo programado (mantenimientos)',
  `Cita` datetime DEFAULT NULL COMMENT 'Hora de Ciudad de México',
  `CitaFin` datetime DEFAULT NULL,
  `IdUsuarioProgramo` bigint DEFAULT NULL,
  `NombreProgramo` varchar(120) DEFAULT NULL COMMENT 'Usuario de Next o del CRM que programó',
  `FechaInicio` datetime DEFAULT NULL COMMENT 'El técnico la inició en campo',
  `Codigo` char(6) DEFAULT NULL COMMENT 'Código vigente; se borra al validarlo o agotarlo',
  `CodigoExpira` datetime DEFAULT NULL,
  `CodigoIntentos` tinyint NOT NULL DEFAULT '0',
  `IdUsuarioCodigo` bigint DEFAULT NULL COMMENT 'Operador que vio el código',
  `FechaCodigoVisto` datetime DEFAULT NULL,
  `FechaCodigoValidado` datetime DEFAULT NULL,
  `Autorizacion` varchar(10) DEFAULT NULL COMMENT 'pendiente | autorizada | rechazada',
  `FechaSolicitudAutorizacion` datetime DEFAULT NULL,
  `IdUsuarioAutorizo` bigint DEFAULT NULL,
  `NombreAutorizo` varchar(120) DEFAULT NULL,
  `FechaAutorizacion` datetime DEFAULT NULL,
  `OrigenAutorizacion` varchar(5) DEFAULT NULL COMMENT 'next | crm',
  `IdInstalacionRetirada` bigint DEFAULT NULL COMMENT 'Instalación dada de baja al cerrar un alta autorizada',
  `ClaveMotivo` varchar(40) DEFAULT NULL COMMENT '-> CatMotivosOrdenServicio',
  `Cobrable` tinyint DEFAULT NULL COMMENT 'No cumplida/cancelada: 1 se paga al técnico',
  `RutaPdf` varchar(500) DEFAULT NULL COMMENT 'PDF de la orden en S3 privado',
  `FechaPdf` datetime DEFAULT NULL COMMENT 'Cuándo se generó el PDF',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_OrdenesServicio_ClaveApp` (`ClaveApp`),
  UNIQUE KEY `UQ_OrdenesServicio_Folio` (`Folio`),
  UNIQUE KEY `UQ_OrdenesServicio_ReferenciaCrm_Unidad` (`ReferenciaCrm`,`Unidad`),
  KEY `IX_OrdenesServicio_Cliente_Fecha` (`IdCliente`,`FechaCreacion`),
  KEY `IX_OrdenesServicio_Instalacion` (`IdInstalacion`),
  KEY `IX_OrdenesServicio_InstalacionResultado` (`IdInstalacionResultado`),
  KEY `IX_OrdenesServicio_Producto` (`IdProducto`),
  KEY `IX_OrdenesServicio_Tecnico_Estatus` (`IdTecnico`,`Estatus`),
  KEY `IX_OrdenesServicio_Tecnico_Estatus_Cita` (`IdTecnico`,`Estatus`,`Cita`),
  KEY `IX_OrdenesServicio_FechaActualizacion` (`FechaActualizacion`),
  CONSTRAINT `FK_OrdenesServicio_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PanelAlarma`
--

DROP TABLE IF EXISTS `PanelAlarma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PanelAlarma` (
  `IdDispositivo` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `CuentaSia` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Ip` varchar(45) DEFAULT NULL,
  `CifradoActivo` tinyint NOT NULL DEFAULT '0',
  `AesKey` varchar(255) DEFAULT NULL COMMENT 'TODO: cifrar en reposo',
  `AesBits` smallint NOT NULL DEFAULT '128',
  `UltimoHeartbeat` datetime DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdDispositivo`),
  UNIQUE KEY `UQ_PanelAlarma_CuentaSia` (`CuentaSia`),
  KEY `IX_PanelAlarma_UltimoHeartbeat` (`UltimoHeartbeat`),
  KEY `FK_PanelAlarma_Dispositivo` (`IdCliente`,`IdDispositivo`),
  CONSTRAINT `FK_PanelAlarma_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Permisos`
--

DROP TABLE IF EXISTS `Permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Permisos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IdModulo` bigint NOT NULL,
  `IdSolucion` bigint DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Permisos_IdModulo_Nombre` (`IdModulo`,`Nombre`),
  KEY `FK_Permisos_Modulo` (`IdModulo`),
  KEY `IX_Permisos_IdModulo_Estatus` (`IdModulo`,`Estatus`),
  KEY `FK_Permisos_Soluciones` (`IdSolucion`),
  CONSTRAINT `FK_Permisos_Modulo` FOREIGN KEY (`IdModulo`) REFERENCES `Modulos` (`Id`),
  CONSTRAINT `FK_Permisos_Soluciones` FOREIGN KEY (`IdSolucion`) REFERENCES `Soluciones` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Personas`
--

DROP TABLE IF EXISTS `Personas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Personas` (
  `IdProducto` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(250) DEFAULT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Foto` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`IdProducto`),
  KEY `FK_Personas_Producto` (`IdCliente`,`IdProducto`),
  CONSTRAINT `FK_Personas_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Posiciones`
--

DROP TABLE IF EXISTS `Posiciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Posiciones` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Imei` bigint NOT NULL,
  `Lat` double NOT NULL,
  `Lng` double NOT NULL,
  `Estado` int DEFAULT NULL,
  `FechaHora` datetime NOT NULL,
  `Velocidad` int NOT NULL,
  `Direccion` int NOT NULL,
  `Odometro` int DEFAULT NULL,
  `Ignicion` int DEFAULT NULL,
  `Alarma1` int DEFAULT NULL,
  `Alarma2` int DEFAULT NULL,
  `Energia` int DEFAULT NULL,
  `IdEvento` int DEFAULT NULL,
  `IdFoto` bigint DEFAULT NULL,
  `FHRegistro` datetime DEFAULT CURRENT_TIMESTAMP,
  `Bateria` float DEFAULT NULL,
  `Alimentacion` float DEFAULT NULL,
  `GPS` int DEFAULT NULL,
  `GSM` int DEFAULT NULL,
  `Movimiento` int DEFAULT NULL,
  `Combustible` float DEFAULT NULL,
  `IdFoto1` bigint DEFAULT NULL,
  `IdFoto2` bigint DEFAULT NULL,
  `IdFoto3` bigint DEFAULT NULL,
  `IdVideo1` bigint DEFAULT NULL,
  `IdVideo2` bigint DEFAULT NULL,
  `IdVideo3` bigint DEFAULT NULL,
  `FuentePosicion` tinyint DEFAULT NULL,
  `RadioM` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Posiciones_Imei_Fecha` (`Imei`,`FechaHora`),
  KEY `IX_Posiciones_Fecha` (`FechaHora`),
  KEY `FK_Posiciones_Foto` (`IdFoto`),
  KEY `FK_Posiciones_Foto1` (`IdFoto1`),
  KEY `FK_Posiciones_Foto2` (`IdFoto2`),
  KEY `FK_Posiciones_Foto3` (`IdFoto3`),
  KEY `FK_Posiciones_Video1` (`IdVideo1`),
  KEY `FK_Posiciones_Video2` (`IdVideo2`),
  KEY `FK_Posiciones_Video3` (`IdVideo3`),
  CONSTRAINT `FK_Posiciones_Foto` FOREIGN KEY (`IdFoto`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_Posiciones_Foto1` FOREIGN KEY (`IdFoto1`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_Posiciones_Foto2` FOREIGN KEY (`IdFoto2`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_Posiciones_Foto3` FOREIGN KEY (`IdFoto3`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_Posiciones_Video1` FOREIGN KEY (`IdVideo1`) REFERENCES `Videos` (`Id`),
  CONSTRAINT `FK_Posiciones_Video2` FOREIGN KEY (`IdVideo2`) REFERENCES `Videos` (`Id`),
  CONSTRAINT `FK_Posiciones_Video3` FOREIGN KEY (`IdVideo3`) REFERENCES `Videos` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1708468 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `trg_pos_before_ins` BEFORE INSERT ON `Posiciones` FOR EACH ROW BEGIN
    DECLARE v_prev_ign INT DEFAULT NULL;
    DECLARE v_exists INT DEFAULT 0;

    IF NEW.Estado IS NULL THEN
        IF NEW.IdEvento = 2 THEN
            SET NEW.Estado = 0;
        ELSEIF NEW.IdEvento = 1 AND IFNULL(NEW.Velocidad, 0) = 0 THEN
            SET NEW.Estado = 0;
        ELSEIF NEW.IdEvento IN (9, 10, 11, 6) AND IFNULL(NEW.Velocidad, 0) < 5 THEN
            SET NEW.Estado = 0;
        ELSEIF NEW.IdEvento = 1 AND IFNULL(NEW.Velocidad, 0) > 5 THEN
            SET NEW.Estado = 1;
        ELSEIF NEW.IdEvento IN (9, 10, 11, 6) AND IFNULL(NEW.Velocidad, 0) > 5 THEN
            SET NEW.Estado = 1;
        ELSEIF NEW.IdEvento = 5 THEN
            SET NEW.Estado = 2;                          -- pánico
        ELSEIF NEW.IdEvento = 8 THEN
            SET NEW.Estado = 3;                          -- puerta
        ELSEIF NEW.IdEvento = 3 THEN
            SET NEW.Estado = 9;                          -- batería
        ELSEIF NEW.IdEvento = 4 THEN
            SET NEW.Estado = 10;                         -- energía
        ELSEIF NEW.IdEvento = 7 THEN
            SET NEW.Estado = 11;                         -- move
        ELSEIF NEW.IdEvento BETWEEN 12 AND 19 THEN
            SET NEW.Estado = 12;                         -- ADAS
        ELSEIF NEW.IdEvento BETWEEN 21 AND 28 THEN
            SET NEW.Estado = 13;                         -- DSM
        ELSEIF NEW.IdEvento IN (29, 30) THEN
            SET NEW.Estado = 14;                         -- conducción
        ELSE
            SELECT COUNT(*) INTO v_exists
              FROM UltimaPosicion
             WHERE Imei = NEW.Imei;
            IF v_exists = 0 THEN
                SET NEW.Estado = NULL;                   -- alta
            ELSE
                SET NEW.Estado = 1;                      -- update fallback
            END IF;
        END IF;
    END IF;

    IF NEW.Ignicion IS NULL THEN
        IF NEW.IdEvento = 2 THEN
            SET NEW.Ignicion = 0;
        ELSEIF NEW.IdEvento = 1 THEN
            SET NEW.Ignicion = 1;
        ELSE
            SELECT u.Ignicion INTO v_prev_ign
              FROM UltimaPosicion u
             WHERE u.Imei = NEW.Imei
             LIMIT 1;
            SET NEW.Ignicion = v_prev_ign;
        END IF;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `trg_pos_after_ins_ult` AFTER INSERT ON `Posiciones` FOR EACH ROW BEGIN
    INSERT INTO `UltimaPosicion`
        (`Imei`, `Lat`, `Lng`, `Estado`, `FechaHora`, `Velocidad`, `Direccion`,
         `Odometro`, `Ignicion`, `Alarma1`, `Alarma2`, `Energia`, `IdEvento`, `IdFoto`,
         `FHRegistro`, `Bateria`, `Alimentacion`, `GPS`, `GSM`, `Movimiento`, `Combustible`,
         `IdFoto1`, `IdFoto2`, `IdFoto3`,
         `IdVideo1`, `IdVideo2`, `IdVideo3`,
         `FuentePosicion`, `RadioM`)
    VALUES
        (NEW.`Imei`, NEW.`Lat`, NEW.`Lng`, NEW.`Estado`, NEW.`FechaHora`, NEW.`Velocidad`, NEW.`Direccion`,
         NEW.`Odometro`, NEW.`Ignicion`, NEW.`Alarma1`, NEW.`Alarma2`, NEW.`Energia`, NEW.`IdEvento`, NEW.`IdFoto`,
         NEW.`FHRegistro`, NEW.`Bateria`, NEW.`Alimentacion`, NEW.`GPS`, NEW.`GSM`, NEW.`Movimiento`, NEW.`Combustible`,
         NEW.`IdFoto1`, NEW.`IdFoto2`, NEW.`IdFoto3`,
         NEW.`IdVideo1`, NEW.`IdVideo2`, NEW.`IdVideo3`,
         NEW.`FuentePosicion`, NEW.`RadioM`)
    
    
    
    ON DUPLICATE KEY UPDATE
        `Lat` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Lat`), `Lat`),
        `Lng` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Lng`), `Lng`),
        `Estado` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Estado`), `Estado`),
        `Velocidad` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Velocidad`), `Velocidad`),
        `Direccion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Direccion`), `Direccion`),
        `Odometro` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Odometro`), `Odometro`),
        `Ignicion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Ignicion`), `Ignicion`),
        `Alarma1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alarma1`), `Alarma1`),
        `Alarma2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alarma2`), `Alarma2`),
        `Energia` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Energia`), `Energia`),
        `IdEvento` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdEvento`), `IdEvento`),
        `IdFoto` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto`), `IdFoto`),
        `FHRegistro` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FHRegistro`), `FHRegistro`),
        `Bateria` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Bateria`), `Bateria`),
        `Alimentacion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Alimentacion`), `Alimentacion`),
        `GPS` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`GPS`), `GPS`),
        `GSM` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`GSM`), `GSM`),
        `Movimiento` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Movimiento`), `Movimiento`),
        `Combustible` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`Combustible`), `Combustible`),
        `IdFoto1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto1`), `IdFoto1`),
        `IdFoto2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto2`), `IdFoto2`),
        `IdFoto3` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdFoto3`), `IdFoto3`),
        `IdVideo1` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo1`), `IdVideo1`),
        `IdVideo2` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo2`), `IdVideo2`),
        `IdVideo3` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`IdVideo3`), `IdVideo3`),
        `FuentePosicion` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FuentePosicion`), `FuentePosicion`),
        `RadioM` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`RadioM`), `RadioM`),
        `FechaHora` = IF((`FechaHora` IS NULL OR VALUES(`FechaHora`) >= `FechaHora`), VALUES(`FechaHora`), `FechaHora`);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `Productos`
--

DROP TABLE IF EXISTS `Productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Productos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdTipoProducto` bigint NOT NULL,
  `Nombre` varchar(400) DEFAULT NULL COMMENT 'Etiqueta legible del producto',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Productos_Cliente_Id` (`IdCliente`,`Id`),
  KEY `IX_Productos_Cliente_Tipo` (`IdCliente`,`IdTipoProducto`,`Estatus`),
  KEY `FK_Productos_Tipo` (`IdTipoProducto`),
  CONSTRAINT `FK_Productos_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Productos_Tipo` FOREIGN KEY (`IdTipoProducto`) REFERENCES `CatTipoProducto` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000427 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PuntosInteres`
--

DROP TABLE IF EXISTS `PuntosInteres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PuntosInteres` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `Nombre` varchar(150) NOT NULL,
  `Descripcion` varchar(500) DEFAULT NULL,
  `Lng` double NOT NULL,
  `Lat` double NOT NULL,
  `RadioMetros` double NOT NULL DEFAULT '25',
  `Icono` varchar(500) DEFAULT NULL,
  `Estatus` smallint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_PuntosInteres_IdCliente` (`IdCliente`),
  CONSTRAINT `FK_PuntosInteres_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RefreshSessions`
--

DROP TABLE IF EXISTS `RefreshSessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RefreshSessions` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdUsuario` bigint NOT NULL,
  `Jti` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `TokenHash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 del refresh JWT en hexadecimal',
  `ExpiresAt` datetime(3) NOT NULL,
  `RevokedAt` datetime(3) DEFAULT NULL,
  `ReplacedById` bigint DEFAULT NULL COMMENT 'PK de la sesión nueva tras rotación',
  `FechaCreacion` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_RefreshSessions_Jti` (`Jti`),
  KEY `IX_RefreshSessions_IdUsuario` (`IdUsuario`),
  KEY `IX_RefreshSessions_IdUsuario_activa` (`IdUsuario`,`RevokedAt`,`ExpiresAt`),
  CONSTRAINT `FK_RefreshSessions_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RelojConfig`
--

DROP TABLE IF EXISTS `RelojConfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RelojConfig` (
  `IdDispositivo` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `IntervaloReporteSegundos` int DEFAULT '300' COMMENT 'UPLOAD: cada cuántos seg reporta posición en movimiento',
  `IntervaloGpsSegundos` int DEFAULT '600' COMMENT 'CR: cada cuántos seg el servidor enciende el GPS (0 = solo en SOS/caída)',
  `DeteccionCaida` tinyint NOT NULL DEFAULT '1' COMMENT 'FALLDOWN x: 1 activa',
  `LlamadaPorCaida` tinyint NOT NULL DEFAULT '1' COMMENT 'FALLDOWN y: 1 el reloj llama al detectar caída',
  `SensibilidadCaida` tinyint NOT NULL DEFAULT '3' COMMENT 'LSSET n+6: 1 a 6, mayor = menos sensible',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdDispositivo`),
  KEY `FK_RelojConfig_Dispositivo` (`IdCliente`,`IdDispositivo`),
  CONSTRAINT `FK_RelojConfig_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Roles`
--

DROP TABLE IF EXISTS `Roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Roles` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `FK_IX_ROLES_NOMBRE` (`Nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SeguimientoIncidentes`
--

DROP TABLE IF EXISTS `SeguimientoIncidentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SeguimientoIncidentes` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdIncidente` bigint NOT NULL,
  `IdUsuario` bigint DEFAULT NULL,
  `FechaHora` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Actividad` varchar(1000) NOT NULL,
  `Medio` varchar(100) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `IX_SeguimientoIncidentes_IdIncidente` (`IdIncidente`),
  KEY `IX_SeguimientoIncidentes_IdUsuario` (`IdUsuario`),
  KEY `IX_SeguimientoIncidentes_Incidente_FechaHora` (`IdIncidente`,`FechaHora`),
  CONSTRAINT `FK_SeguimientoIncidentes_Incidentes` FOREIGN KEY (`IdIncidente`) REFERENCES `Incidentes` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_SeguimientoIncidentes_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Sims`
--

DROP TABLE IF EXISTS `Sims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sims` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IMEI` varchar(25) DEFAULT NULL COMMENT 'Identificador del suscriptor en la red móvil ICC',
  `NumeroTelefono` varchar(20) DEFAULT NULL COMMENT 'Número de línea / MSISDN del SIM',
  `IdTelefonia` bigint NOT NULL COMMENT 'Compañía telefónica del SIM',
  `IdPlanTelefonia` bigint NOT NULL COMMENT 'Plan de datos contratado',
  `IdCliente` bigint NOT NULL COMMENT 'Cliente/tenant propietario del SIM',
  `Notas` varchar(500) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Sims_Cliente_Id` (`IdCliente`,`Id`),
  UNIQUE KEY `UQ_Sims_IMEI` (`IMEI`),
  KEY `IX_Sims_IdTelefonia` (`IdTelefonia`),
  KEY `IX_Sims_IdPlanTelefonia` (`IdPlanTelefonia`),
  KEY `IX_Sims_IMEI` (`IMEI`),
  KEY `IX_Sims_IdCliente_IdEstatusSim` (`IdCliente`),
  CONSTRAINT `FK_Sims_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Sims_PlanTelefonia` FOREIGN KEY (`IdPlanTelefonia`) REFERENCES `CatPlanesTelefonia` (`Id`),
  CONSTRAINT `FK_Sims_Telefonia` FOREIGN KEY (`IdTelefonia`) REFERENCES `CatTelefonia` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=416 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Soluciones`
--

DROP TABLE IF EXISTS `Soluciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Soluciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Codigo` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Soluciones_Codigo` (`Codigo`),
  KEY `IX_Soluciones_Nombre` (`Nombre`),
  KEY `IX_Soluciones_Codigo_Estatus` (`Codigo`,`Estatus`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TelemetryHuerfanos`
--

DROP TABLE IF EXISTS `TelemetryHuerfanos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TelemetryHuerfanos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Protocol` varchar(16) NOT NULL COMMENT 'jt808 | jimi | axpro',
  `DeviceId` varchar(32) NOT NULL COMMENT 'NumeroSerie (jt808), IMEI (jimi) o cuenta SIA (axpro)',
  `Motivo` varchar(32) NOT NULL COMMENT 'no_registrado | sin_imei',
  `PrimeraVez` datetime NOT NULL,
  `UltimaVez` datetime NOT NULL,
  `Mensajes` bigint NOT NULL DEFAULT '1',
  `UltimoRoutingKey` varchar(128) DEFAULT NULL,
  `UltimaLat` double DEFAULT NULL,
  `UltimaLng` double DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_TelemetryHuerfanos_ProtocolDevice` (`Protocol`,`DeviceId`),
  KEY `IX_TelemetryHuerfanos_UltimaVez` (`UltimaVez`)
) ENGINE=InnoDB AUTO_INCREMENT=2272 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TelemetryIngestLog`
--

DROP TABLE IF EXISTS `TelemetryIngestLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TelemetryIngestLog` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `EventId` varchar(64) NOT NULL,
  `Protocol` varchar(16) NOT NULL,
  `Kind` varchar(32) NOT NULL,
  `DeviceId` varchar(20) NOT NULL,
  `RoutingKey` varchar(128) DEFAULT NULL,
  `PosicionId` bigint DEFAULT NULL,
  `PayloadJson` json DEFAULT NULL,
  `FHRegistro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_TelemetryIngestLog_EventId` (`EventId`),
  KEY `IX_TelemetryIngestLog_DeviceId` (`DeviceId`),
  KEY `IX_TelemetryIngestLog_FHRegistro` (`FHRegistro`)
) ENGINE=InnoDB AUTO_INCREMENT=1708792 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TrackcamConfig`
--

DROP TABLE IF EXISTS `TrackcamConfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TrackcamConfig` (
  `IdDispositivo` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `IntervaloPosicionSegundos` int DEFAULT NULL COMMENT 'Cada cuántos seg reporta posición (en movimiento)',
  `IntervaloPosicionDetenidoSegundos` int DEFAULT NULL COMMENT 'Cada cuántos seg reporta detenido / ACC off',
  `IntervaloImagenSegundos` int DEFAULT NULL COMMENT 'Cada cuántos seg captura/envía imágenes',
  `VelocidadMinimaAlarmasKmh` int DEFAULT NULL COMMENT 'Velocidad a partir de la cual se habilitan las alarmas de conducción (ADAS/DSM). Debajo de esto no se evalúan',
  `Canal1Activo` tinyint(1) NOT NULL DEFAULT '0',
  `Canal2Activo` tinyint(1) NOT NULL DEFAULT '0',
  `Canal3Activo` tinyint(1) NOT NULL DEFAULT '0',
  `Canal4Activo` tinyint NOT NULL DEFAULT '0',
  `AlarmaFatiga` tinyint(1) NOT NULL DEFAULT '0',
  `UmbralFatiga` tinyint DEFAULT NULL COMMENT 'Nivel 1-10 (DSM). Mayor = más severo',
  `AlarmaTelefono` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaFumar` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaDistraccion` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaConductorAusente` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaCinturon` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaObstruccionCamara` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaColisionFrontal` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaSalidaCarril` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaDistanciaCorta` tinyint(1) NOT NULL DEFAULT '0',
  `DistanciaCortaSegundos` smallint DEFAULT NULL COMMENT 'Umbral de distancia al vehículo de adelante (100 ms)',
  `AlarmaColisionPeaton` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaCambioCarrilFrecuente` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaExcesoSenalTransito` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaObstaculo` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaFallaAdas` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaAceleracionBrusca` tinyint(1) NOT NULL DEFAULT '0',
  `UmbralAceleracionG` smallint DEFAULT NULL COMMENT 'Umbral aceleración, unidad 1/100 g',
  `AlarmaFrenadoBrusco` tinyint(1) NOT NULL DEFAULT '0',
  `UmbralFrenadoG` smallint DEFAULT NULL COMMENT 'Umbral desaceleración, unidad 1/100 g',
  `AlarmaGiroBrusco` tinyint(1) NOT NULL DEFAULT '0',
  `UmbralGiroG` smallint DEFAULT NULL COMMENT 'Umbral giro, unidad 1/100 g',
  `AlarmaRalenti` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaApagadoAnormal` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaAproximacionTrasera` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaAproximacionTraseraIzq` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaAproximacionTraseraDer` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaExcesoVelocidad` tinyint(1) NOT NULL DEFAULT '0',
  `VelocidadMaximaKmh` int DEFAULT NULL COMMENT 'Umbral de exceso de velocidad',
  `AlarmaFatigaTiempo` tinyint(1) NOT NULL DEFAULT '0',
  `AlarmaColision` tinyint(1) NOT NULL DEFAULT '0',
  `ColisionAceleracionG` smallint DEFAULT NULL COMMENT 'Umbral colisión, unidad 0.1 g',
  `AlarmaVolteo` tinyint(1) NOT NULL DEFAULT '0',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdDispositivo`),
  KEY `FK_TrackcamConfig_Dispositivo` (`IdCliente`,`IdDispositivo`),
  CONSTRAINT `FK_TrackcamConfig_Dispositivo` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UltimaPosicion`
--

DROP TABLE IF EXISTS `UltimaPosicion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UltimaPosicion` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Imei` bigint NOT NULL,
  `Lat` double NOT NULL,
  `Lng` double NOT NULL,
  `Estado` int DEFAULT NULL,
  `FechaHora` datetime NOT NULL,
  `Velocidad` int NOT NULL,
  `Direccion` int NOT NULL,
  `Odometro` int DEFAULT NULL,
  `Ignicion` int DEFAULT NULL,
  `Alarma1` int DEFAULT NULL,
  `Alarma2` int DEFAULT NULL,
  `Energia` int DEFAULT NULL,
  `IdEvento` int DEFAULT NULL,
  `IdFoto` bigint DEFAULT NULL,
  `FHRegistro` datetime DEFAULT CURRENT_TIMESTAMP,
  `Bateria` float DEFAULT NULL,
  `Alimentacion` float DEFAULT NULL,
  `GPS` int DEFAULT NULL,
  `GSM` int DEFAULT NULL,
  `Movimiento` int DEFAULT NULL,
  `Combustible` float DEFAULT NULL,
  `IdFoto1` bigint DEFAULT NULL,
  `IdFoto2` bigint DEFAULT NULL,
  `IdFoto3` bigint DEFAULT NULL,
  `IdVideo1` bigint DEFAULT NULL,
  `IdVideo2` bigint DEFAULT NULL,
  `IdVideo3` bigint DEFAULT NULL,
  `FuentePosicion` tinyint DEFAULT NULL,
  `RadioM` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_UltimaPosicion_Imei` (`Imei`),
  KEY `FK_UltimaPosicion_Foto` (`IdFoto`),
  KEY `FK_UltimaPosicion_Foto1` (`IdFoto1`),
  KEY `FK_UltimaPosicion_Foto2` (`IdFoto2`),
  KEY `FK_UltimaPosicion_Foto3` (`IdFoto3`),
  KEY `FK_UltimaPosicion_Video1` (`IdVideo1`),
  KEY `FK_UltimaPosicion_Video2` (`IdVideo2`),
  KEY `FK_UltimaPosicion_Video3` (`IdVideo3`),
  CONSTRAINT `FK_UltimaPosicion_Dispositivo` FOREIGN KEY (`Imei`) REFERENCES `Dispositivos` (`Imei`) ON UPDATE CASCADE,
  CONSTRAINT `FK_UltimaPosicion_Foto` FOREIGN KEY (`IdFoto`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Foto1` FOREIGN KEY (`IdFoto1`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Foto2` FOREIGN KEY (`IdFoto2`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Foto3` FOREIGN KEY (`IdFoto3`) REFERENCES `Fotos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Video1` FOREIGN KEY (`IdVideo1`) REFERENCES `Videos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Video2` FOREIGN KEY (`IdVideo2`) REFERENCES `Videos` (`Id`),
  CONSTRAINT `FK_UltimaPosicion_Video3` FOREIGN KEY (`IdVideo3`) REFERENCES `Videos` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1708767 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UltimoEventoAlarma`
--

DROP TABLE IF EXISTS `UltimoEventoAlarma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UltimoEventoAlarma` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdPanel` bigint NOT NULL,
  `IdCliente` bigint DEFAULT NULL,
  `IdEventoAlarma` bigint NOT NULL COMMENT 'FK al evento en EventoAlarma',
  `CodigoSia` varchar(8) NOT NULL,
  `TipoEvento` varchar(40) NOT NULL,
  `EsRestauracion` tinyint NOT NULL DEFAULT '0',
  `Zona` int DEFAULT NULL,
  `Particion` int DEFAULT NULL,
  `CodigoUsuario` int DEFAULT NULL COMMENT 'Código de usuario que disparó el evento (eventos de armado/desarmado)',
  `NombreDispositivo` varchar(100) DEFAULT NULL COMMENT 'Nombre del sensor/zona/dispositivo (campo S del frame, ej. Cocina, Sirena)',
  `Severidad` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '1=Info, 2=Advertencia, 3=Crítica',
  `IpOrigen` varchar(45) DEFAULT NULL,
  `RecibidoEn` datetime NOT NULL,
  `TimestampPanel` varchar(40) DEFAULT NULL,
  `FHRegistro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_UltimoEventoAlarma_IdPanel` (`IdPanel`),
  KEY `IX_UltimoEventoAlarma_IdCliente` (`IdCliente`),
  KEY `IX_UltimoEventoAlarma_CodigoSia` (`CodigoSia`),
  KEY `IX_UltimoEventoAlarma_RecibidoEn` (`RecibidoEn`),
  KEY `FK_UltimoEventoAlarma_Evento` (`IdEventoAlarma`),
  CONSTRAINT `FK_UltimoEventoAlarma_Cliente` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_UltimoEventoAlarma_Dispositivos` FOREIGN KEY (`IdPanel`) REFERENCES `Dispositivos` (`Id`),
  CONSTRAINT `FK_UltimoEventoAlarma_Evento` FOREIGN KEY (`IdEventoAlarma`) REFERENCES `EventoAlarma` (`Id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4278 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Usuarios`
--

DROP TABLE IF EXISTS `Usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Usuarios` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL,
  `IdRol` bigint NOT NULL,
  `Nombre` varchar(100) DEFAULT NULL,
  `ApellidoPaterno` varchar(100) DEFAULT NULL,
  `ApellidoMaterno` varchar(100) DEFAULT NULL,
  `UserName` varchar(100) NOT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `PinHash` varchar(255) DEFAULT NULL,
  `ActualizacionPassword` datetime DEFAULT NULL,
  `ActualizacionPin` datetime DEFAULT NULL,
  `EmailConfirmado` tinyint NOT NULL DEFAULT '0',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FotoPerfil` varchar(500) DEFAULT NULL,
  `Telefono` varchar(14) DEFAULT NULL,
  `UltimoLogin` datetime DEFAULT NULL,
  `NivelAcceso` int NOT NULL DEFAULT '0',
  `TokenHash` varchar(100) DEFAULT NULL,
  `TokenExpira` datetime DEFAULT NULL,
  `TokenRevocado` tinyint DEFAULT '0',
  `TokenHashAdmin` varchar(45) DEFAULT NULL,
  `IdFaceAuth` bigint DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Usuarios_IdCliente_UserName` (`IdCliente`,`UserName`),
  KEY `FK_Usuarios_Clientes` (`IdCliente`),
  KEY `FK_Usuarios_Roles` (`IdRol`),
  KEY `IX_Usuarios_IdCliente_Estatus` (`IdCliente`,`Estatus`),
  CONSTRAINT `FK_Usuarios_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Usuarios_Roles` FOREIGN KEY (`IdRol`) REFERENCES `Roles` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UsuariosGeocerca`
--

DROP TABLE IF EXISTS `UsuariosGeocerca`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UsuariosGeocerca` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdUsuario` bigint NOT NULL,
  `IdGeocerca` bigint NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_UsuarioGeocerca_Usuario_Geocerca` (`IdUsuario`,`IdGeocerca`),
  KEY `IX_UsuarioGeocerca_IdUsuario` (`IdUsuario`),
  KEY `IX_UsuarioGeocerca_IdGeocerca` (`IdGeocerca`),
  CONSTRAINT `FK_UsuarioGeocerca_Geocerca` FOREIGN KEY (`IdGeocerca`) REFERENCES `Geocercas` (`Id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_UsuarioGeocerca_Usuario` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UsuariosInstalaciones`
--

DROP TABLE IF EXISTS `UsuariosInstalaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UsuariosInstalaciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `IdUsuario` bigint NOT NULL,
  `IdInstalacion` bigint NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `FK_UsuariosInstalaciones_Usuarios` (`IdUsuario`),
  KEY `FK_UsuariosInstalaciones_Instalaciones` (`IdInstalacion`),
  CONSTRAINT `FK_UsuariosInstalaciones_Instalaciones` FOREIGN KEY (`IdInstalacion`) REFERENCES `Instalaciones` (`Id`),
  CONSTRAINT `FK_UsuariosInstalaciones_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1305 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UsuariosPermisos`
--

DROP TABLE IF EXISTS `UsuariosPermisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UsuariosPermisos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  `IdUsuario` bigint NOT NULL,
  `IdPermiso` bigint NOT NULL,
  `IdSolucion` bigint DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_UsuariosPermisos_IdUsuario_IdPermiso` (`IdUsuario`,`IdPermiso`),
  KEY `FK_UsuariosPermisos_Usuarios` (`IdUsuario`),
  KEY `FK_UsuariosPermisos_Permisos` (`IdPermiso`),
  KEY `FK_UsuaPerm_Soluciones` (`IdSolucion`),
  KEY `IX_UsuariosPermisos_IdUsuario_IdSolucion` (`IdUsuario`,`IdSolucion`),
  CONSTRAINT `FK_UsuaPerm_Soluciones` FOREIGN KEY (`IdSolucion`) REFERENCES `Soluciones` (`Id`),
  CONSTRAINT `FK_UsuariosPermisos_Permisos` FOREIGN KEY (`IdPermiso`) REFERENCES `Permisos` (`Id`),
  CONSTRAINT `FK_UsuariosPermisos_Usuarios` FOREIGN KEY (`IdUsuario`) REFERENCES `Usuarios` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1432 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Vehiculos`
--

DROP TABLE IF EXISTS `Vehiculos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Vehiculos` (
  `IdProducto` bigint NOT NULL,
  `IdCliente` bigint NOT NULL,
  `Placa` varchar(10) NOT NULL,
  `NumeroEconomico` varchar(50) DEFAULT NULL,
  `IdMarcaVehiculo` bigint DEFAULT NULL,
  `IdModeloVehiculo` bigint DEFAULT NULL,
  `Anio` int DEFAULT NULL,
  `Color` varchar(30) DEFAULT NULL,
  `NumeroSerie` varchar(20) DEFAULT NULL COMMENT 'VIN',
  `Foto` varchar(500) DEFAULT NULL,
  `FotoFrente` varchar(500) DEFAULT NULL,
  `FotoTrasera` varchar(500) DEFAULT NULL,
  `FotoDerecha` varchar(500) DEFAULT NULL,
  `FotoIzquierda` varchar(500) DEFAULT NULL,
  `FotoExtra` varchar(500) DEFAULT NULL,
  `TarjetaCirculacion` varchar(500) DEFAULT NULL,
  `PolizaSeguro` varchar(500) DEFAULT NULL,
  `PermisoCarga` varchar(500) DEFAULT NULL,
  `IdCombustible` bigint DEFAULT NULL,
  `KM` float DEFAULT NULL,
  `CapacidadLitros` float DEFAULT NULL,
  PRIMARY KEY (`IdProducto`),
  UNIQUE KEY `UQ_Vehiculos_Cliente_Placa` (`IdCliente`,`Placa`),
  KEY `FK_Vehiculos_Marca_idx` (`IdMarcaVehiculo`),
  KEY `FK_Vehiculos_Modelo_idx` (`IdModeloVehiculo`),
  KEY `FK_Vehiculos_Combustible_idx` (`IdCombustible`),
  KEY `FK_Vehiculos_Producto` (`IdCliente`,`IdProducto`),
  CONSTRAINT `FK_Vehiculos_Combustible` FOREIGN KEY (`IdCombustible`) REFERENCES `CatTipoCombustible` (`Id`),
  CONSTRAINT `FK_Vehiculos_Marca` FOREIGN KEY (`IdMarcaVehiculo`) REFERENCES `CatMarcas` (`Id`),
  CONSTRAINT `FK_Vehiculos_Modelo` FOREIGN KEY (`IdModeloVehiculo`) REFERENCES `CatModelos` (`Id`),
  CONSTRAINT `FK_Vehiculos_Producto` FOREIGN KEY (`IdCliente`, `IdProducto`) REFERENCES `Productos` (`IdCliente`, `Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Videos`
--

DROP TABLE IF EXISTS `Videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Videos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Imei` bigint DEFAULT NULL,
  `Ruta` varchar(500) DEFAULT NULL,
  `RutaServidor` varchar(500) DEFAULT NULL COMMENT 'Ruta física del archivo en el servidor (disco)',
  `FechaHora` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'Next'
--
/*!50003 DROP PROCEDURE IF EXISTS `spGetClientes` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE  PROCEDURE `spGetClientes`(IN p_IdCliente INT)
BEGIN 

    -- Evita que se devuelvan mensajes intermedios 

    SET SESSION max_sp_recursion_depth = 10; 

 

    -- CTE recursiva para recorrer la jerarquía de clientes 

    WITH RECURSIVE CTE_Clientes AS ( 

        SELECT  

            Id, 

            IdPadre, 

            RFC, 

            TipoPersona, 

            Estatus, 

            Logotipo AS Logo, 

            Nombre, 

            ApellidoPaterno, 

            ApellidoMaterno, 

            Telefono, 

            Correo, 

            Nombre AS Padre 

        FROM Clientes 

        WHERE Id = p_IdCliente 

 

        UNION ALL 

 

        SELECT  

            c.Id, 

            c.IdPadre, 

            c.RFC, 

            c.TipoPersona, 

            c.Estatus, 

            c.Logotipo AS Logo, 

            c.Nombre, 

            c.ApellidoPaterno, 

            c.ApellidoMaterno, 

            c.Telefono, 

            c.Correo, 

            cte.Nombre AS Padre 

        FROM Clientes c 

        INNER JOIN CTE_Clientes cte ON c.IdPadre = cte.Id 

    ) 

    SELECT * FROM CTE_Clientes; 

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 22:00:06

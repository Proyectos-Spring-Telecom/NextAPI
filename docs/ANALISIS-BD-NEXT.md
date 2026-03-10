# Análisis de la Base de Datos Next

Documento de análisis del respaldo `Next20260306.sql` — Base de datos para la plataforma de monitoreo vehicular y gestión de flotas.

---

## 1. Información general

| Campo | Valor |
|-------|-------|
| **Base de datos** | `Next` |
| **Motor** | MySQL 8.0.45 |
| **Charset** | utf8mb4 / utf8mb4_0900_ai_ci |
| **Fecha del respaldo** | 2026-03-06 14:19:04 |
| **Servidor origen** | 216.238.90.14 |
| **Total de tablas** | 35 |

---

## 2. Estructura de tablas

### 2.1 Tablas core / autenticación (8)

| Tabla | Descripción | Registros |
|-------|-------------|-----------|
| **Clientes** | Tenants con jerarquía (IdPadre), RFC único | 2 |
| **Usuarios** | Usuarios por cliente, IdRol, PasswordHash, PinHash | 2 |
| **Roles** | Roles del sistema (SA, Administrador) | 2 |
| **Modulos** | Catálogo de módulos | 11 |
| **Permisos** | Permisos por módulo (Listado, Crear, Actualizar, CambiarEstatus) | 84 |
| **UsuariosPermisos** | Asignación usuario–permiso | 40 |
| **CodigoAutenticacion** | Códigos 2FA, recuperación | 0 |
| **Bitacora** | Auditoría de acciones con Query JSON | 435 |

### 2.2 Catálogos (20)

| Catálogo | Registros | Uso |
|----------|-----------|-----|
| CatMarcaVehiculo | 30 | Nissan, Chevrolet, VW, Toyota, Ford, etc. |
| CatModeloVehiculo | 84 | Por marca (NP300, Urvan, Aveo, Hilux, etc.) |
| CatTipoVehiculo | 10 | Sedán, SUV, Camioneta, Autobús, etc. |
| CatEstatusVehiculo | 5 | Disponible, En Uso, En Taller, etc. |
| CatTipoCombustible | 7 | Magna, Premium, Diésel, Gas LP, etc. |
| CatMarcaDispositivo | 9 | Teltonika, Queclink, Concox, CalAmp, etc. |
| CatModeloDispositivo | 22 | FMB120, GV350MG, GT06N, LMU-2630, etc. |
| CatTipoDispositivo | 4 | Vehicular, Personal, OBD-II, Activos |
| CatEstatusDispositivo | 6 | Disponible, Activo, Inactivo, etc. |
| CatEstatusSim | 5 | Disponible, Activo, Suspendido, etc. |
| CatEstatusInstalacion | 4 | Activa, Desinstalada, Suspendida, etc. |
| CatTelefonia | 6 | Telcel, AT&T, Movistar, Bait, Jasper, Hologram |
| CatPlanesTelefonia | 6 | Planes M2M 1MB, 5MB, 50MB, IoT 2MB, 10MB, etc. |
| CatTipoLicencia | 6 | A, B, C, D, E, Federal |
| CatCategoriaLicencia | 2 | Permanente, Temporal |
| CatEstatusOperador | 6 | Activo, Suspendido, Incapacitado, etc. |
| CatEstatusMantenimiento | 4 | Programado, En Proceso, Completado, Cancelado |
| CatCategoriaMantenimientoMecanico | 10 | Motor, Frenos, Suspensión, etc. |
| CatCaracteristicasEvaluacionMttoMecanico | 35 | Sub-items de evaluación |
| CatTipoAlerta | 14 | Exceso velocidad, Geocercas, Motor, SOS, etc. |
| CatTipoGeocerca | 3 | Circular, Poligonal, Ruta/Corredor |
| CatTipoVerificaciones | 2 | Mecánica, Ambiental |
| CatReferenciaServicio | 2 | Por Kilometraje, Por Tiempo |

### 2.3 Tablas transaccionales — Flota y GPS (7)

| Tabla | Descripción | Registros | FK principales |
|-------|-------------|-----------|----------------|
| **Vehiculos** | Flota por cliente (Placa, Económico, Marca/Modelo, etc.) | 0 | IdCliente, IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo |
| **Operadores** | Conductores vinculados a Usuario | 0 | IdCliente, IdUsuario, IdEstatusOperador |
| **Licencias** | Licencias por operador (NúmeroLicencia único) | 0 | IdOperador, IdTipoLicencia, IdCategoriaLicencia |
| **Sims** | Tarjetas SIM (ICC único) | 0 | IdCliente, IdTelefonia, IdPlanTelefonia, IdEstatusSim |
| **Dispositivos** | Dispositivos GPS (NumeroSerie/IMEI único) | 0 | IdCliente, IdModeloDispositivo, IdTipoDispositivo, IdSim |
| **Instalaciones** | Dispositivo–Vehículo (1:1 por cliente) | 0 | IdCliente, IdDispositivo, IdVehiculo, IdEstatusInstalacion |
| **HistoricoInstalaciones** | Historial de instalaciones/desinstalaciones | 0 | IdInstalacion, IdDispositivo, IdVehiculo, Accion |

### 2.4 Tabla no presente: Posiciones

**No existe** la tabla `Posiciones` para almacenar coordenadas GPS. Según el documento de contexto, se planea:

- Campos: IdDispositivo, Latitud, Longitud, Velocidad, Rumbo, FechaHora, EstadoMotor, NivelBateria, etc.
- Índices para consultas por rango de fechas (series de tiempo)
- Referencia a IdDispositivo para trazar posiciones por vehículo vía Instalaciones

---

## 3. Convenciones y patrones

| Convención | Aplicación |
|------------|------------|
| **Soft delete** | Campo `Estatus` (1=Activo, 0=Inactivo) en todas las tablas |
| **Auditoría** | FechaCreacion, FechaActualizacion en tablas transaccionales |
| **Multitenancy** | IdCliente en Vehiculos, Operadores, Sims, Dispositivos, Instalaciones |
| **Unique compuesto** | UQ_*_IdCliente_Id para aislamiento por tenant |
| **Nombrado** | PascalCase, prefijo Cat para catálogos, Id para FKs |
| **Unique por negocio** | RFC (Clientes), Placa (Vehiculos), NumeroSerie (Dispositivos), ICC (Sims), NumeroLicencia (Licencias) |

---

## 4. Relaciones clave

```
Clientes (IdPadre → Clientes)
    ├── Usuarios (IdCliente, IdRol → Roles)
    │       └── UsuariosPermisos (IdUsuario, IdPermiso)
    ├── Vehiculos (IdCliente, IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo)
    ├── Operadores (IdCliente, IdUsuario → Usuarios, IdEstatusOperador)
    │       └── Licencias (IdOperador, IdTipoLicencia, IdCategoriaLicencia)
    ├── Sims (IdCliente, IdTelefonia, IdPlanTelefonia, IdEstatusSim)
    ├── Dispositivos (IdCliente, IdModeloDispositivo, IdTipoDispositivo, IdSim → Sims)
    └── Instalaciones (IdCliente, IdDispositivo → Dispositivos, IdVehiculo → Vehiculos)
            └── HistoricoInstalaciones
```

**Cadena operativa:** Telefonia → PlanTelefonia → SIM → Dispositivo → Instalación → Vehículo

---

## 5. Procedimiento almacenado

| Procedimiento | Descripción |
|---------------|-------------|
| **spGetClientes** | CTE recursiva para obtener jerarquía de clientes (padre–hijos) a partir de un IdCliente |

---

## 6. Módulos y permisos

Los permisos están alineados con los módulos:

| Módulo | Permisos |
|--------|----------|
| Cliente (1) | Listado, Crear, Actualizar, CambiarEstatus |
| Usuarios (2) | Listado, Crear, Actualizar, CambiarEstatus |
| Roles (3) | Listado, Crear, Actualizar, CambiarEstatus |
| Permisos (4) | Listado, Crear, Actualizar, CambiarEstatus |
| Modulos (5) | Listado, Crear, Actualizar, CambiarEstatus |
| Sims (14) | Listado, Crear, Actualizar, CambiarEstatus |
| Dispositivos (15) | Listado, Crear, Actualizar, CambiarEstatus |
| Vehiculos (16) | Listado, Crear, Actualizar, CambiarEstatus |
| Instalaciones (17) | Listado, Crear, Actualizar, CambiarEstatus |
| Operadores (18) | Listado, Crear, Actualizar, CambiarEstatus |
| Licencias (19) | Listado, Crear, Actualizar, CambiarEstatus |

---

## 7. Datos de prueba actuales

| Entidad | Cantidad | Detalle |
|---------|----------|---------|
| Clientes | 2 | Next (IdPadre null), Empresas SA.DE C.V (IdPadre=1) |
| Usuarios | 2 | root@next.mx (Rol SA), admin@next.mx (Rol Administrador) |
| Roles | 2 | SA, Administrador |
| Bitacora | 435 | Registros de operaciones sobre Clientes y Usuarios |
| UsuariosPermisos | 40 | Usuario 1 con permisos 1–20, Usuario 44 con permisos 1–20 |

---

## 8. Tablas vacías (listas para uso)

- Vehiculos
- Operadores
- Licencias
- Sims
- Dispositivos
- Instalaciones
- HistoricoInstalaciones
- CodigoAutenticacion

---

## 9. Recomendaciones para NextAPI

1. **DB_DATABASE** en variables de entorno debe ser `Next` (no `next_db`).
2. **Entidades TypeORM:** generar o actualizar para: Vehiculos, Operadores, Licencias, Sims, Dispositivos, Instalaciones, HistoricoInstalaciones y todos los catálogos que use la API.
3. **Posiciones:** diseñar e implementar tabla `Posiciones` cuando se desarrolle el módulo de monitoreo GPS.
4. **spGetClientes:** NextAPI ya lo usa en BitacoraLoggerService; validar compatibilidad con la estructura actual.
5. **Permisos 61–84:** permisos para Sims, Dispositivos, Vehiculos, Instalaciones, Operadores y Licencias; asegurar que UsuariosPermisos y guards estén alineados.

---

*Análisis basado en el respaldo Next20260306.sql.*

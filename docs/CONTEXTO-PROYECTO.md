# Contexto del Proyecto NextAPI

Documento de referencia que integra la visión del sistema **Next** (Plataforma de Monitoreo Vehicular y Gestión de Flotas) con el estado actual del backend NextAPI.

---

## 1. Qué es Next

**Next** es la plataforma central de monitoreo vehicular y gestión integral de flotas. Funciona como el sistema maestro (**Source of Truth**) de todo el ecosistema, siendo el dueño absoluto de las entidades fundamentales del negocio:

- Clientes y usuarios
- Vehículos y operadores
- Licencias de conducir
- Dispositivos GPS y tarjetas SIM
- Posiciones en tiempo real

Ningún otro servicio del ecosistema (como ShiftControl o futuros módulos) puede crear, modificar o eliminar directamente estos datos. Todos consumen la información de Next exclusivamente a través de su API REST versionada y sus WebSockets de posiciones.

**NextAPI** es el backend NestJS de esta plataforma. El frontend es Angular 17+.

### 1.1 Visión a largo plazo

Next aspira a ser la plataforma de referencia para empresas de transporte en México, ofreciendo:

- Monitoreo GPS en tiempo real
- Control total de la flota
- Gestión documental de operadores
- Análisis inteligente de datos de telemetría
- Ecosistema de módulos conectados (ShiftControl, App Operador, etc.)

### 1.2 Problema que resuelve

| Desafío | Solución de Next |
|---------|------------------|
| **Visibilidad en tiempo real** | Saber dónde están los vehículos, si están en ruta o detenidos, velocidad actual |
| **Gestión de flota fragmentada** | Centralizar vehículos, operadores, licencias y dispositivos |
| **Seguridad y control** | Alertas por exceso de velocidad, geocercas, botón de pánico |
| **Conectividad IoT compleja** | Administrar dispositivos GPS, SIMs, planes de datos, instalaciones |
| **Cumplimiento regulatorio** | Control de vencimiento de licencias, verificaciones vehiculares, pólizas |
| **Toma de decisiones sin datos** | Historial de recorridos, consumo de combustible, KM, patrones de uso |

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | NestJS (Node.js + TypeScript) — NextAPI |
| **Frontend** | Angular 17+ |
| **Base de datos** | MySQL 8.0 (`Next`) |
| **ORM** | TypeORM |
| **Autenticación** | JWT (Passport.js) |
| **Rate limiting** | `@nestjs/throttler` (global + Auth) |
| **Tiempo real** | WebSocket Gateway (Socket.IO) — planificado |
| **Receptor GPS** | TCP/UDP Server — planificado |
| **Almacenamiento** | AWS S3 / MinIO (implementado) |
| **Correo** | Nodemailer |
| **Infraestructura** | Docker + Nginx — planificado |

---

## 3. Principios arquitectónicos

| Principio | Aplicación en Next |
|-----------|--------------------|
| **Single Source of Truth** | Next es el ÚNICO lugar donde se crean, modifican y eliminan datos de clientes, vehículos, operadores, dispositivos y posiciones |
| **Database per Service** | Next tiene su propia base de datos (`Next`). Ningún otro servicio accede directamente |
| **Clean Architecture** | Controller (HTTP) → Service (lógica) → Repository (datos) → Entity |
| **Multitenancy** | Toda entidad tiene `IdCliente`. Cada query filtra por tenant |
| **API-first** | Toda la funcionalidad vía REST API (`/api`, sin versionado) |
| **Event Emitter** | Webhooks cuando cambia una entidad clave. Next no conoce a los consumidores |
| **Desconocimiento** | Next NO sabe que ShiftControl (ni otros servicios) existen. Es agnóstico |

---

## 4. Dominios y módulos

### 4.1 Dominio: Autenticación y Multitenancy — Implementado

| Módulo | Estado | Responsabilidad |
|--------|--------|-----------------|
| AuthModule | ✅ | Login (`accessToken`, `refreshToken`, `expiresIn`), `GET /login/me` (perfil), PIN operador, recuperación/confirmación, verify (6 dígitos), `POST /login/refresh`, `POST /login/logout`, JWT, rate limiting por usuario (THROTTLE_*) |
| ClientesModule | ✅ | ABM de clientes (tenants), jerarquía padre-hijo, RFC único |
| UsuariosModule | ✅ | ABM de usuarios por cliente, IdRol, credenciales, foto de perfil |
| RolesModule | ✅ | Definición de roles (Admin, Supervisor, Monitorista, etc.) |
| PermisosModule | ✅ | Permisos granulares por módulo, UsuariosPermisos |
| ModulosModule | ✅ | Catálogo de módulos del sistema |
| Bitacora | ✅ | Auditoría de acciones |
| MailModule | ✅ | Confirmación de cuenta, recuperación de contraseña (sin rutas HTTP; servicio inyectable) |
| S3Module | ✅ | Documentos, fotos, evidencias |

**Multitenancy:** Todo registro tiene `IdCliente`. El TenantGuard (o equivalente) debe extraer `IdCliente` del JWT e inyectarlo en las queries.

**Componentes transversales:**

- `src/common/validators/match-password.constraint.ts` — Valida que password y confirmación coincidan
- `src/common/validators/pin.validator.ts` — Valida NIP de 4 dígitos
- `src/utils/correccion-hora.ts` — `horaDesfasada()` (otros módulos si aplica); **Auth** usa fecha/hora del servidor (`new Date()`) para códigos y expiración
- `src/common/ApiResponse.ts` — Tipos `ApiResponseCommon`, `ApiCrudResponse` para respuestas consistentes

**Estructura estándar de módulos de catálogo (Cat):**

| Elemento | Especificación |
|----------|----------------|
| **Proyecto** | NextAPI |
| **applySchema** | Default: `Next` (DB_DATABASE del entorno) |
| **ApiBearerAuth** | `'bearer-token'` |
| **Guards** | `JwtAuthGuard` + `RolesGuard` + `@Roles()` |
| **GET findAll** | Query `soloActivos` opcional en listados |
| **Rutas de estatus** | `PATCH /estatus/:id` (explícito) |
| **DELETE** | Soft delete vía PATCH (cambiar Estatus a 0); no DELETE físico |
| **Bitácora** | `BitacoraLoggerService` en create, update y delete |
| **Respuestas** | `ApiCrudResponse`, `ApiResponseCommon` |
| **Paginación** | `GET /list` (lista completa) + `GET /:page/:limit` (paginado) |

Rutas estándar: `GET /list`, `GET /:page/:limit`, `GET /:id`, `POST /`, `PUT` o `PATCH /:id`, `PATCH /estatus/:id`.

---

### 4.2 Dominio: Gestión de Flota — Parcialmente implementado

| Módulo | Estado BD | Estado API | Responsabilidad |
|--------|-----------|------------|-----------------|
| VehiculosModule | ✅ Tabla existente | 🔲 | ABM de vehículos: placa, económico, marca/modelo, documentos, fotos, estado |
| OperadoresModule | ✅ Tabla existente | ✅ Implementado | ABM de conductores (1:1 Usuario, CURP/NSS únicos por cliente, documentos, CatEstatusOperador) |
| LicenciasModule | ✅ Tabla existente | 🔲 | Licencias por operador (tipo A–E, Federal), vencimientos, alertas |

**Catálogos en BD (poblados) con API:** CatMarcaVehiculo (30), CatModeloVehiculo (84), CatTipoVehiculo (10), CatEstatusVehiculo (5), CatTipoCombustible (7), CatTipoLicencia (6), CatCategoriaLicencia (2), CatEstatusOperador (6).

---

### 4.3 Dominio: Dispositivos GPS e IoT — Parcialmente implementado

| Módulo | Estado BD | Estado API | Responsabilidad |
|--------|-----------|------------|-----------------|
| SimsModule | ✅ Tabla existente | ✅ Implementado | Tarjetas SIM: ICC, plan de datos, estatus (multitenancy, ICC único) |
| DispositivosModule | ✅ Tabla existente | ✅ Implementado | ABM de dispositivos GPS por NumeroSerie, marca/modelo, SIM asignado |
| InstalacionesModule | ✅ Tabla existente + HistoricoInstalaciones | 🔲 | Vinculación Dispositivo–Vehículo (1:1), historial de cambios |

**Catálogos en BD (poblados) con API:** CatMarcaDispositivo (9), CatModeloDispositivo (22), CatTipoDispositivo (4), CatEstatusDispositivo (6), CatEstatusSim (5), CatEstatusInstalacion (4), CatTelefonia (6), CatPlanesTelefonia (6).

**Cadena operativa:** CatTelefonia → CatPlanesTelefonia → Sims → Dispositivos → Instalaciones → Vehiculos.

---

### 4.4 Dominio: Monitoreo y Posiciones en Tiempo Real — Pendiente

| Componente | Estado BD | Estado API | Responsabilidad |
|------------|-----------|------------|-----------------|
| Receptor TCP/UDP | — | 🔲 | Recibir tramas GPS (GT06, Teltonika, Concox, Queclink) |
| PosicionesModule | ❌ Tabla no existe | 🔲 | Almacenar posiciones (lat, lng, velocidad, rumbo, fecha/hora) — tabla por crear |
| WebSocket Gateway | — | 🔲 | Redistribuir posiciones en vivo: `/ws/posiciones/:imei` |
| API REST | — | 🔲 | `GET /posiciones/ultima/:vehiculoId`, `GET /posiciones/historial` |

**Nota:** La tabla `Posiciones` no existe en la BD actual; debe crearse para el módulo de monitoreo GPS.

---

### 4.5 Dominio: Alertas y Geocercas — Fase futura

| Módulo | Estado | Alcance planeado |
|--------|--------|------------------|
| AlertasModule | 🔲 | Motor de reglas: exceso de velocidad, motor en horario no permitido, batería baja |
| GeocercasModule | 🔲 | Zonas (circular, poligonal, ruta), eventos entrada/salida |
| NotificacionesModule | 🔲 | Push (Firebase), SMS (Twilio), Email, Webhook |

---

### 4.6 Dominio: Mantenimiento Mecánico — Fase 3 (catálogo preparado)

- **CatTipoVerificaciones** — ✅ API implementada (tipos de verificaciones vehiculares)
- Órdenes de mantenimiento preventivo y correctivo
- Evaluaciones mecánicas (10 categorías, 35 puntos)
- Verificaciones vehiculares (ambiental, técnico-mecánica)
- Historial mecánico por vehículo

---

## 5. Estado actual de NextAPI

### Implementado

- **NestJS 11**, TypeScript, MySQL 8
- **Prefijo global:** `/api` — todas las rutas bajo `http://localhost:3010/api`
- **Swagger:** `http://localhost:3010/api/docs`
- **Auth:** `POST /login` y `POST /login/operador/accesso/nip` devuelven `{ accessToken, refreshToken, expiresIn }`; renovación con **`POST /login/refresh`** (body `{ refreshToken }`); cierre de sesión con **`POST /login/logout`** (JWT Bearer). Perfil (usuario, rol, cliente, permisos) en **`GET /login/me`** con Bearer. Errores de login unificados (*Credenciales inválidas*). Recuperación: siempre mensaje genérico. Verify: código **6 dígitos**, intentos limitados. Rate limiting **por usuario** (keyGenerator) en login, PIN, verify, recuperación, refresh, logout (variables `THROTTLE_*`).
- **Clientes, Usuarios, Roles, Permisos, Modulos:** CRUD con paginación, listas sin paginar, filtrado por rol y tenant
- **Bitácora:** Auditoría de acciones con paginación
- **S3:** Subida de archivos (PNG, JPG, JPEG, PDF) hasta 10 MB
- **Mail:** Confirmación de cuenta y restablecimiento de contraseña (Nodemailer, sin rutas HTTP, servicio inyectable)
- **JWT + JwtAuthGuard + RolesGuard + @Roles()**
- **Validadores:** `MatchPasswordConstraint` (password/confirmación), `PinValidator` (NIP 4 dígitos)
- **CodigoAutenticacion:** códigos de 6 dígitos; vigencia 5 min (confirmación correo) / 15 min (recuperación); columna `IntentosFallidos` para verify
- **Catálogos API (20):** CatCategoriaLicencia, CatEstatusDispositivo, CatEstatusInstalacion, CatEstatusOperador, CatEstatusSim, CatEstatusVehiculo, CatMarcaDispositivo, CatMarcaVehiculo, CatModeloDispositivo, CatModeloVehiculo, CatReferenciaServicio, CatTelefonia, CatPlanesTelefonia, CatTipoAlerta, CatTipoCombustible, CatTipoDispositivo, CatTipoGeocerca, CatTipoLicencia, CatTipoVehiculo, CatTipoVerificaciones (CRUD estándar, Bitácora, soft delete)
- **SimsModule:** ABM de tarjetas SIM (multitenancy, ICC único, FKs a CatTelefonia, CatPlanesTelefonia, CatEstatusSim)
- **DispositivosModule:** ABM de dispositivos GPS (multitenancy, NumeroSerie único, IdSim obligatorio)
- **OperadoresModule:** ABM de conductores (multitenancy, 1:1 Usuario, CURP/NSS únicos por cliente, documentos S3, CatEstatusOperador)

### Roles y permisos

| IdRol | Nombre | Acceso típico |
|-------|--------|---------------|
| 1 | SuperAdministrador | Crear clientes, usuarios, roles, módulos, permisos; eliminar clientes, usuarios, módulos |
| 2 | Administrador | Gestión de su cliente |
| 3 | Monitorista | Consultas, monitoreo |

### Pendiente (API)

- TenantGuard para multitenancy automático
- VehiculosModule, LicenciasModule (tablas BD listas)
- InstalacionesModule (tablas BD listas)
- PosicionesModule + tabla Posiciones + Receptor TCP/UDP + WebSocket
- Webhook Emitter
- Dominios de Alertas, Geocercas, Mantenimiento

**Nota:** SimsModule, DispositivosModule y OperadoresModule ya están implementados. Los permisos 61–84 para Sims, Dispositivos, Vehiculos, Instalaciones, Operadores y Licencias existen en la BD.

---

## 6. API como proveedor

Next funciona como **proveedor de datos** para todo el ecosistema. Principios de la API:

| Principio | Descripción |
|-----------|-------------|
| **Prefijo /api** | Endpoints bajo `/api` (sin versionado) |
| **Paginada** | `{ data: [], paginated: { total, page, limit, totalPages } }` (solo en respuestas paginadas) |
| **Filtrable por tenant** | JWT contiene IdCliente, filtrado automático |
| **Campos calculados** | Respuestas enriquecidas (ej: `operador.licenciaVigente`) |
| **Idempotente** | PUT idempotente |
| **Consistente** | Mismo formato JSON, errores `{ statusCode, message, error }` |

### Webhook Emitter (planificado)

Next emitiría eventos a URLs en `WEBHOOK_SUBSCRIBERS`:

| Evento | Cuándo |
|--------|--------|
| vehiculo.created | Crear vehículo |
| vehiculo.updated | Editar vehículo |
| operador.updated | Editar operador |
| operador.suspended | Suspender operador |
| licencia.expired | Cron detecta vencimiento |
| instalacion.changed | Cambio dispositivo–vehículo |

---

## 7. Modelo de datos — Base de datos Next

> Basado en el respaldo `Next20260306.sql`. Ver `docs/ANALISIS-BD-NEXT.md` para detalle completo.

### 7.1 Resumen por categoría

| Categoría | Tablas | Registros | Estado |
|-----------|--------|-----------|--------|
| **Core / Auth** | Clientes, Usuarios, Roles, Modulos, Permisos, UsuariosPermisos, CodigoAutenticacion, Bitacora | Con datos | ✅ API implementada |
| **Flota** | Vehiculos, Operadores, Licencias | Vacías | ✅ Tablas listas, API pendiente |
| **GPS / IoT** | Dispositivos, Sims, Instalaciones, HistoricoInstalaciones | Vacías | ✅ Sims y Dispositivos con API; Instalaciones pendiente |
| **Catálogos** | 20 tablas Cat* (marcas, modelos, tipos, estatus, etc.) | Poblados | Listos para consumo |
| **Monitoreo** | Posiciones | — | ❌ Tabla no existe, por crear |
| **Mantenimiento** | CatEstatusMantenimiento, CatCategoriaMantenimientoMecanico, etc. | Poblados | Catálogos listos |

### 7.2 Relaciones clave

```
Clientes (IdPadre → Clientes)
    ├── Usuarios (IdCliente, IdRol → Roles)
    │       └── UsuariosPermisos (IdUsuario, IdPermiso)
    ├── Vehiculos (IdCliente, IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo)
    ├── Operadores (IdCliente, IdUsuario → Usuarios, IdEstatusOperador)
    │       └── Licencias (IdOperador, IdTipoLicencia, IdCategoriaLicencia)
    ├── Sims (IdCliente, IdTelefonia, IdPlanTelefonia, IdEstatusSim)
    ├── Dispositivos (IdCliente, IdModeloDispositivo, IdTipoDispositivo, IdSim → Sims)
    └── Instalaciones (IdCliente, IdDispositivo, IdVehiculo, IdEstatusInstalacion)
            └── HistoricoInstalaciones
```

### 7.3 Módulos y permisos en BD

| Id | Módulo | Permisos (formato: Listado, Crear, Actualizar, CambiarEstatus) |
|----|--------|----------------------------------------------------------------|
| 1 | Cliente | 4 permisos |
| 2 | Usuarios | 4 permisos |
| 3 | Roles | 4 permisos |
| 4 | Permisos | 4 permisos |
| 5 | Modulos | 4 permisos |
| 14 | Sims | 4 permisos |
| 15 | Dispositivos | 4 permisos |
| 16 | Vehiculos | 4 permisos |
| 17 | Instalaciones | 4 permisos |
| 18 | Operadores | 4 permisos |
| 19 | Licencias | 4 permisos |

**Total:** 11 módulos, 84 permisos.

### 7.4 Procedimiento almacenado

| Procedimiento | Descripción |
|---------------|-------------|
| **spGetClientes** | CTE recursiva para jerarquía de clientes (padre–hijos). Usado por BitacoraLoggerService. |

### 7.5 Convenciones de BD

- **Soft delete:** Campo `Estatus` (1=Activo, 0=Inactivo). No DELETE físico.
- **Auditoría:** FechaCreacion, FechaActualizacion, Bitacora (Query JSON).
- **Multitenancy:** `IdCliente` en Vehiculos, Operadores, Sims, Dispositivos, Instalaciones.
- **Nombrado:** PascalCase, prefijo `Cat` para catálogos, prefijo `Id` para FKs.
- **Unique:** RFC (Clientes), Placa (Vehiculos), NumeroSerie (Dispositivos), ICC (Sims), NumeroLicencia (Licencias).

---

## 8. Roadmap

| Fase | Alcance | Estado |
|------|---------|--------|
| **FASE 1** | Core + Flota + GPS (ABM, Receptor TCP, Posiciones, WebSocket, Webhooks) | En desarrollo |
| **FASE 2** | Monitoreo avanzado, alertas, geocercas, notificaciones, replay, reportes | Planeado |
| **FASE 3** | Mantenimiento mecánico, verificaciones vehiculares | Catálogos listos |
| **FASE 4** | Analítica, ML, scoring operadores, app móvil, Event-Driven, Kubernetes | Visión |

---

## 9. Relación con otros servicios

| Regla | Descripción |
|-------|-------------|
| **Next NO conoce** | No importa módulos de ShiftControl, no llama APIs externas |
| **Next EXPONE** | API REST, WebSocket de posiciones, Webhooks genéricos |
| **Next EMITE** | Eventos a URLs suscritas (fire-and-forget con reintentos) |
| **Next PROTEGE** | JWT, IdCliente, permisos, filtrado por tenant, rate limiting por usuario en Auth (refresh token y revocación en logout) |

### Servicios del ecosistema

| Servicio | Estado | Consume de Next | Aporta |
|----------|--------|-----------------|--------|
| ShiftControl | En desarrollo | Vehículos, Operadores, Licencias, Posiciones | Turnos, Bitácora, Checklist, Incidencias |
| App Operador | Planeado | Auth, Posiciones | Check-in móvil, reportes, botón de pánico |
| Facturación | Futuro | Clientes, Vehículos, Planes | Cobro, facturación CFDI |
| Reportes BI | Futuro | Posiciones, KM, Alertas | Dashboards, exportación |

---

## 10. Endpoints actuales (NextAPI)

Resumen de lo implementado. Ver Swagger en `http://localhost:3010/api/docs` para detalle. Todas las rutas llevan prefijo `/api`.

### Autenticación (`/api/login`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/login` | Login userName + password → `{ accessToken, refreshToken, expiresIn }` (throttle por usuario) |
| POST | `/login/operador/accesso/nip` | Login por PIN → mismo formato que `/login` |
| GET | `/login/me` | Perfil completo (rol, cliente, permisos, etc.); **JWT Bearer obligatorio** |
| POST | `/login/refresh` | Renovar accessToken: body `{ refreshToken }` → `{ token, accessToken, expiresIn }` (throttle por usuario) |
| POST | `/login/logout` | Cerrar sesión (revoca refresh token); **JWT Bearer obligatorio** (throttle por usuario) |
| POST | `/login/usuario/solicitud/recuperacion` | Solicitar recuperación; respuesta siempre genérica (throttle por usuario) |
| POST | `/login/recuperar/confirmacion` | Reenviar código de confirmación (6 dígitos) |
| POST | `/login/cambiar/accesso` | Cambiar contraseña (JWT) |
| PATCH | `/login/verify` | Verificar cuenta: body `{ userName, codigo }` (6 dígitos); throttle por usuario |

**Contrato para el cliente (Angular / consumidores):**

1. Tras login exitoso, guardar `accessToken` y `refreshToken`; usar `expiresIn` para renovar sesión.
2. Antes de que expire el access token, llamar **`POST /api/login/refresh`** con body `{ refreshToken }` para obtener nuevo `accessToken`.
3. Para cerrar sesión en el dispositivo, llamar **`POST /api/login/logout`** con `Authorization: Bearer <accessToken>`.
4. Llamar **`GET /api/login/me`** con header `Authorization: Bearer <accessToken>` para obtener el objeto de sesión (usuario, permisos, rol, cliente).
5. Fallos de credenciales en login/PIN: **401** con mensaje genérico; no asumir mensajes distintos por "usuario inexistente" vs "contraseña incorrecta".
6. Recuperación: el cuerpo de éxito es siempre el mismo texto; no inferir existencia del correo por la respuesta.

### Clientes (`/api/clientes`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa (sin paginar) |
| GET | `/list/:cliente` | Lista por ID de cliente |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |
| POST | `/` | Crear (Roles 1) |
| PATCH | `/:id` | Actualizar |
| PATCH | `/estatus/:id` | Cambiar estatus |
| DELETE | `/:id` | Eliminar (Roles 1) |

### Usuarios (`/api/usuarios`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa |
| GET | `/list/cliente/:id` | Lista por cliente |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |
| POST | `/` | Crear (Roles 1) |
| PATCH | `/:id` | Actualizar |
| PATCH | `/estatus/:id` | Cambiar estatus |
| PATCH | `/actualizar/contrasena` | Cambiar mi contraseña (usuario desde JWT) |
| PATCH | `/mi-nip` | Crear o actualizar NIP (usuario desde JWT) |
| DELETE | `/:id` | Eliminar (Roles 1) |

### Roles (`/api/roles`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |
| POST | `/` | Crear (Roles 1) |
| PUT | `/:id` | Actualizar |
| PATCH | `/estatus/:id` | Cambiar estatus |

### Permisos (`/api/permisos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa |
| GET | `/permisosAgrupados` | Permisos agrupados del usuario |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |
| POST | `/` | Crear (Roles 1) |
| PUT | `/:id` | Actualizar |
| PATCH | `/estatus/:id` | Cambiar estatus |

### Modulos (`/api/modulos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |
| POST | `/` | Crear (Roles 1) |
| PUT | `/:id` | Actualizar |
| PATCH | `/estatus/:id` | Cambiar estatus |
| DELETE | `/:id` | Eliminar (Roles 1) |

### Bitácora (`/api/bitacora`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/list` | Lista completa |
| GET | `/:page/:limit` | Paginado |
| GET | `/:id` | Por ID |

### S3 (`/api/s3`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/upload` | Subir archivo (PNG, JPG, JPEG, PDF; máx. 10 MB) |

### Catálogos (CRUD estándar)

Cada catálogo expone las mismas rutas bajo su prefijo. Todas usan `@Roles()`, JWT Bearer y Bitácora.

| Prefijo | Descripción |
|---------|-------------|
| `/api/cat-categoria-licencia` | Categorías de licencia (Tipo A, B, etc.) |
| `/api/cat-estatus-dispositivo` | Estatus de dispositivos GPS |
| `/api/cat-marca-dispositivo` | Marcas de dispositivos (Teltonika, Queclink, etc.) |
| `/api/cat-modelo-dispositivo` | Modelos de dispositivos (por marca) |
| `/api/cat-estatus-instalacion` | Estatus de instalaciones dispositivo–vehículo |
| `/api/cat-estatus-operador` | Estatus de operadores |
| `/api/cat-estatus-sim` | Estatus de tarjetas SIM |
| `/api/cat-estatus-vehiculo` | Estatus de vehículos |
| `/api/cat-marca-vehiculo` | Marcas de vehículos |
| `/api/cat-modelo-vehiculo` | Modelos de vehículos (por marca) |
| `/api/cat-referencia-servicio` | Referencia de servicio (kilometraje, tiempo) |
| `/api/cat-telefonia` | Compañías telefónicas |
| `/api/cat-planes-telefonia` | Planes de datos por compañía |
| `/api/cat-tipo-alerta` | Tipos de alertas (exceso velocidad, geocercas, etc.) |
| `/api/cat-tipo-combustible` | Tipos de combustible |
| `/api/cat-tipo-dispositivo` | Tipos de dispositivo (vehicular, personal, OBD-II) |
| `/api/cat-tipo-geocerca` | Tipos de geocerca |
| `/api/cat-tipo-licencia` | Tipos de licencia (A–E, Federal) |
| `/api/cat-tipo-vehiculo` | Tipos de vehículo (sedán, camioneta, etc.) |
| `/api/cat-tipo-verificaciones` | Tipos de verificaciones vehiculares (Fase 3) |

**Rutas por catálogo:** `GET /list?soloActivos=`, `GET /:page/:limit`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /estatus/:id`

### Módulos operativos (multitenancy)

| Prefijo | Descripción |
|---------|-------------|
| `/api/sims` | Tarjetas SIM: ICC, plan, estatus. IdCliente desde JWT. ICC único global. |
| `/api/dispositivos` | Dispositivos GPS: NumeroSerie, modelo, tipo, SIM. IdCliente desde JWT. NumeroSerie único global. |
| `/api/operadores` | Operadores (conductores): 1:1 con Usuario, CURP/NSS únicos por cliente, documentos. IdCliente desde JWT. |

**Rutas:** `GET /list`, `GET /:page/:limit`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /estatus/:id`

### Mail

El módulo Mail **no expone rutas HTTP**. Es un servicio de apoyo usado por Auth para enviar correos:

- `sendConfirmationEmail(to, name, token, codigo)` — Bienvenida y código de verificación
- `sendResetPasswordEmail(to, name, token, codigo)` — Restablecimiento con enlace `/#/nueva-contrasena?token=`

---

## 11. Variables de entorno

| Variable | Descripción |
|----------|-------------|
| PORT | Puerto (default: 3010) |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE | MySQL — **DB_DATABASE debe ser `Next`** |
| JWT_SECRET, JWT_EXPIRES_IN | JWT access token (el login devuelve `expiresIn` en segundos) |
| JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN | Refresh token (default `7d`); usado en `POST /login/refresh` |
| JWT_CONFIRMACION | Opcional; expiración de JWT en enlaces de correo (default `15m`) |
| THROTTLE_LOGIN_LIMIT, THROTTLE_LOGIN_TTL_MS, THROTTLE_PIN_*, THROTTLE_VERIFY_*, THROTTLE_RECUPERACION_*, THROTTLE_REFRESH_*, THROTTLE_LOGOUT_* | Límites y ventana (ms) para rate limiting por usuario en Auth; ver `FLUJO-SEGURIDAD-AUTH.md` |
| AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET | S3 |
| UPLOAD_MAX_SIZE | Límite de subida (bytes) |
| HOST, SMTP, E_MAIL, MAIL_PASSWORD | Nodemailer (obligatorias) |
| MAIL_FRONTEND_URL | URL base del frontend para enlaces en correos (opcional). Ej: `https://springtelecom.mx/shiftcontrolapp` |
| WEBHOOK_SUBSCRIBERS | URLs para webhooks (futuro) |

---

*Documento actualizado (marzo 2026): OperadoresModule implementado. Ver `docs/FLUJO-MODULO-OPERADORES.md` y `docs/CONTRATO-PROYECTO-NEXTAPI.md` v1.3.*

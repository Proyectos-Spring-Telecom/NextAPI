# Contrato de Proyecto — NextAPI

**Plataforma Next | Monitoreo Vehicular y Gestión de Flotas**

---

## 1. Identificación del proyecto

| Campo | Valor |
|-------|-------|
| **Nombre del proyecto** | NextAPI |
| **Descripción** | Backend de la plataforma Next — sistema maestro (Source of Truth) de monitoreo vehicular y gestión integral de flotas |
| **Versión del documento** | 1.3 |
| **Fecha de vigencia** | Marzo 2026 (OperadoresModule implementado) |

---

## 2. Objeto del contrato

El presente contrato define el **alcance técnico**, **entregables** y **especificaciones** del desarrollo y mantenimiento del backend **NextAPI**, que forma parte del ecosistema **Next** para empresas de transporte en México.

NextAPI es el único lugar donde se crean, modifican y eliminan los datos fundamentales del negocio: clientes, usuarios, vehículos, operadores, licencias, dispositivos GPS y posiciones. Los demás servicios (ShiftControl, App Operador, etc.) consumen la información exclusivamente a través de la API REST y WebSockets expuestos por Next.

---

## 3. Stack tecnológico contratado

| Capa | Tecnología | Estado |
|------|------------|--------|
| **Backend** | NestJS 11 (Node.js + TypeScript) | Implementado |
| **Base de datos** | MySQL 8.0 — Base de datos `Next` | Implementado |
| **ORM** | TypeORM | Implementado |
| **Autenticación** | JWT (Passport.js) | Implementado |
| **Rate limiting** | `@nestjs/throttler` (global + límites en Auth) | Implementado |
| **Almacenamiento** | AWS S3 | Implementado |
| **Correo** | Nodemailer | Implementado |
| **Documentación API** | Swagger / OpenAPI | Implementado |
| **Tiempo real** | WebSocket Gateway (Socket.IO) | Planificado |
| **Receptor GPS** | TCP/UDP Server | Planificado |
| **Infraestructura** | Docker + Nginx | Planificado |

---

## 4. Alcance funcional

### 4.1 Fase implementada (entregada)

| Módulo | Funcionalidad | Rutas base |
|--------|---------------|------------|
| **Auth** | Login (`accessToken`, `refreshToken`, `expiresIn`), perfil vía `GET /login/me` (JWT), login por PIN, recuperación (respuesta genérica), confirmación, cambio de contraseña, verificación (código 6 dígitos, intentos limitados), `POST /login/refresh`, `POST /login/logout`, rate limiting por usuario en rutas sensibles (variables `THROTTLE_*`) | `/api/login` |
| **Clientes** | ABM, jerarquía padre-hijo, listas paginadas y sin paginar | `/api/clientes` |
| **Usuarios** | ABM, cambio de contraseña propia, gestión de NIP | `/api/usuarios` |
| **Roles** | ABM de roles del sistema | `/api/roles` |
| **Permisos** | ABM, permisos agrupados por usuario | `/api/permisos` |
| **Modulos** | ABM del catálogo de módulos | `/api/modulos` |
| **Bitácora** | Consulta de auditoría de acciones | `/api/bitacora` |
| **S3** | Subida de archivos (PNG, JPG, JPEG, PDF; máx. 10 MB) | `/api/s3` |
| **Catálogos** | CatCategoriaLicencia, CatEstatusDispositivo, CatMarcaDispositivo, CatModeloDispositivo, CatEstatusInstalacion, CatEstatusOperador, CatEstatusSim, CatEstatusVehiculo, CatMarcaVehiculo, CatModeloVehiculo, CatReferenciaServicio, CatTipoAlerta, CatTipoCombustible, CatTipoDispositivo, CatTipoGeocerca, CatTipoLicencia, CatTipoVehiculo, CatTipoVerificaciones, CatTelefonia, CatPlanesTelefonia — CRUD estándar, Bitácora, soft delete | `/api/cat-*` |
| **Sims** | ABM de tarjetas SIM (multitenancy, ICC único) | `/api/sims` |
| **Dispositivos** | ABM de dispositivos GPS (multitenancy, NumeroSerie único) | `/api/dispositivos` |
| **Operadores** | ABM de conductores (1:1 con Usuario, CURP/NSS únicos por cliente, documentos) | `/api/operadores` |
| **Mail** | Servicio inyectable: confirmación de cuenta, restablecimiento de contraseña | (sin rutas HTTP) |

### 4.2 Fase en desarrollo (Fase 1)

| Componente | Descripción | Dependencias |
|------------|-------------|--------------|
| TenantGuard | Filtrado automático por `IdCliente` | JWT |
| VehiculosModule | ABM de vehículos | BD lista |
| LicenciasModule | ABM de licencias por operador | OperadoresModule |
| InstalacionesModule | Vinculación dispositivo–vehículo | BD lista |
| PosicionesModule | Almacenamiento de coordenadas GPS | Crear tabla `Posiciones` |
| Receptor TCP/UDP | Recepción de tramas GPS (GT06, Teltonika, Concox, Queclink) | — |
| WebSocket Gateway | Redistribución de posiciones en vivo | PosicionesModule |
| Webhook Emitter | Emisión de eventos a URLs suscritas | Vehículos, Operadores, Licencias, Instalaciones |

### 4.3 Fases futuras (Fase 2, 3, 4)

- **Fase 2:** Alertas, geocercas, notificaciones, replay, reportes
- **Fase 3:** Mantenimiento mecánico, verificaciones vehiculares
- **Fase 4:** Analítica, ML, scoring operadores, app móvil, Event-Driven, Kubernetes

---

## 5. Principios arquitectónicos (acuerdos técnicos)

| Principio | Aplicación obligatoria |
|-----------|------------------------|
| **Single Source of Truth** | Next es el ÚNICO lugar donde se crean, modifican y eliminan datos de clientes, vehículos, operadores, dispositivos y posiciones |
| **Database per Service** | Base de datos `Next` exclusiva; ningún otro servicio accede directamente |
| **Clean Architecture** | Controller → Service → Repository → Entity |
| **Multitenancy** | Toda entidad tiene `IdCliente`; cada query filtra por tenant |
| **API-first** | Toda la funcionalidad vía REST API (`/api`, sin versionado); formato consistente `{ data, paginated }` |
| **Desconocimiento** | Next NO importa módulos de ShiftControl ni llama APIs externas; es agnóstico a los consumidores |

---

## 6. Especificaciones de la API

### 6.1 Formato de respuestas

- **Paginación:** Las rutas `GET /:page/:limit` retornan `{ data: [], paginated: { total, page, limit, totalPages } }`. El objeto `paginated` solo está presente en respuestas paginadas; las rutas `GET /list` retornan `{ data: [] }` sin `paginated`.
- **Errores:** `{ statusCode, message, error }`
- **Prefijo global:** `/api` (todas las rutas)

### 6.2 Seguridad

- Autenticación JWT Bearer
- Guards: `JwtAuthGuard`, `RolesGuard`
- Decorador `@Roles()` para control de acceso
- **Rate limiting:** guard global (`ThrottlerGuard`) y límites por **usuario** en Auth (login, PIN, verify, recuperación, refresh, logout) mediante `keyGenerator` (userId/userName); límites configurables con variables `THROTTLE_*`
- **Login:** respuesta unificada ante fallo (`401` — *Credenciales inválidas*); no enumeración de usuarios; `PasswordHash` / `PinHash` no se exponen en consultas estándar
- **Flujo cliente post-login:** `POST /login` o `POST /login/operador/accesso/nip` → `{ accessToken, refreshToken, expiresIn }`; renovar sesión con **`POST /login/refresh`** (body `{ refreshToken }`); cerrar sesión con **`POST /login/logout`** (JWT Bearer); datos de usuario y permisos vía **`GET /login/me`** con `Authorization: Bearer <accessToken>`
- **Recuperación de contraseña:** respuesta HTTP siempre la misma (no revela si el correo existe); límite interno por usuario/correo
- **Verificación de cuenta:** código numérico de **6 dígitos**, vigencia y contador de intentos fallidos (tabla `CodigoAutenticacion`)
- Roles: ()

### 6.3 Documentación

- Swagger disponible en `/api/docs`
- Servidores: `http://localhost:3010`, `https://springtelecom.mx/nextAPI`

### 6.4 Convenciones para módulos de catálogo (Cat)

Al crear nuevos módulos de catálogo (tablas `Cat*`), se aplican las siguientes convenciones:

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

**Estructura de rutas estándar para catálogos:**
- `GET /list` — Lista sin paginar (con `soloActivos` opcional)
- `GET /:page/:limit` — Lista paginada
- `GET /:id` — Por ID
- `POST /` — Crear
- `PATCH /:id` — Actualizar
- `PATCH /estatus/:id` — Cambiar estatus (soft delete/reactivar)

---

## 7. Infraestructura y variables de entorno

El proyecto requiere las siguientes variables de entorno (validadas en arranque):

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| PORT | No (default: 3010) | Puerto de la aplicación |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE | Sí | MySQL — **DB_DATABASE = `Next`** |
| JWT_SECRET, JWT_EXPIRES_IN | Sí | Configuración JWT (access token; el login devuelve `expiresIn` en segundos) |
| JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN | Sí (default `7d`) | Refresh token: secreto y expiración; usado en `POST /login/refresh` |
| JWT_CONFIRMACION | No (default `15m`) | Expiración de tokens en enlaces de correo (confirmación / recuperación) |
| THROTTLE_LOGIN_LIMIT, THROTTLE_LOGIN_TTL_MS, THROTTLE_PIN_*, THROTTLE_VERIFY_*, THROTTLE_RECUPERACION_*, THROTTLE_REFRESH_*, THROTTLE_LOGOUT_* | No (valores por defecto) | Límites y ventana (ms) para rate limiting por usuario en Auth; ver `FLUJO-SEGURIDAD-AUTH.md` |
| AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET | Sí | S3 |
| UPLOAD_MAX_SIZE | Sí | Límite de subida (bytes) |
| HOST, SMTP, E_MAIL, MAIL_PASSWORD | Sí | Nodemailer |
| MAIL_FRONTEND_URL | No | URL base del frontend para enlaces en correos |
| WEBHOOK_SUBSCRIBERS | No (futuro) | URLs para webhooks |

---

## 8. Base de datos

| Aspecto | Especificación |
|---------|----------------|
| **Base de datos** | `Next` (MySQL 8.0) |
| **Tablas core** | Clientes, Usuarios (incl. `TokenHash`, `TokenExpira`, `TokenRevocado` para refresh token), Roles, Modulos, Permisos, UsuariosPermisos, CodigoAutenticacion (`Codigo` 6 caracteres, `IntentosFallidos`), Bitacora |
| **Tablas flota** | Vehiculos, Operadores, Licencias |
| **Tablas GPS** | Dispositivos, Sims, Instalaciones, HistoricoInstalaciones |
| **Catálogos** | 20 tablas Cat* (marcas, modelos, tipos, estatus) |
| **Soft delete** | Campo `Estatus` (1=Activo, 0=Inactivo); no DELETE físico |
| **Auditoría** | FechaCreacion, FechaActualizacion, Bitacora (Query JSON) |

---

## 9. Criterios de aceptación por fase

### Fase implementada

- [x] Login y autenticación JWT operativos (accessToken + refreshToken + `expiresIn`; perfil en `GET /login/me`; `POST /login/refresh`, `POST /login/logout`)
- [x] Endurecimiento Auth: rate limiting por usuario (THROTTLE_*), mensajes genéricos en login/recuperación/verify, códigos 6 dígitos
- [x] CRUD de Clientes, Usuarios, Roles, Permisos, Modulos
- [x] Bitácora de auditoría consultable
- [x] Subida de archivos a S3
- [x] Correos de confirmación y restablecimiento de contraseña
- [x] Swagger documentado y accesible
- [x] Catálogos API (20 catálogos: CatCategoriaLicencia, CatEstatus*, CatMarca*, CatModelo*, CatReferenciaServicio, CatTipoAlerta, CatTipoCombustible, CatTipoDispositivo, CatTipoGeocerca, CatTipoLicencia, CatTipoVehiculo, CatTipoVerificaciones, CatTelefonia, CatPlanesTelefonia) operativos
- [x] SimsModule operativo (multitenancy, ICC único)
- [x] DispositivosModule operativo (multitenancy, NumeroSerie único)
- [x] OperadoresModule operativo (multitenancy, 1:1 Usuario, CURP/NSS únicos por cliente)

### Fase 1 (en desarrollo)

- [ ] VehiculosModule, LicenciasModule operativos
- [ ] InstalacionesModule operativo
- [ ] PosicionesModule con tabla creada
- [ ] Receptor TCP/UDP recibiendo tramas GPS
- [ ] WebSocket Gateway redistribuyendo posiciones
- [ ] Webhook Emitter funcional

---

## 10. Exclusiones

Quedan **fuera del alcance** de este contrato:

- Desarrollo del frontend Angular
- Desarrollo de ShiftControl, App Operador u otros servicios consumidores
- Infraestructura de producción (Docker, Kubernetes) hasta Fase 4
- Integración con sistemas de facturación o terceros no especificados
- Diseño UX/UI
- Pruebas de carga o penetración (salvo acordado por addendum)

---

## 11. Documentos de referencia

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| Contexto del proyecto | `docs/CONTEXTO-PROYECTO.md` | Visión, estado actual, endpoints, roadmap |
| Análisis de BD | `docs/ANALISIS-BD-NEXT.md` | Estructura de tablas, relaciones, catálogos |
| Flujos de implementación | `docs/FLUJO-*.md` | Pasos para crear catálogos (Cat*) y módulos operativos (Sims, Dispositivos) |
| Seguridad Auth | `docs/FLUJO-SEGURIDAD-AUTH.md`, `docs/SEGURIDAD-LOGIN-NEXTAPI.md` | Hardening login, verify, recuperación |

---

## 12. Aceptación

El presente contrato constituye el acuerdo técnico entre las partes para el proyecto NextAPI. Cualquier modificación al alcance o especificaciones deberá documentarse por escrito (addendum) y ser aceptada por ambas partes.

---

*Alineado con `docs/CONTEXTO-PROYECTO.md` (marzo 2026). v1.3: OperadoresModule. Ver `docs/FLUJO-MODULO-OPERADORES.md`.*

# Contrato de Proyecto — NextAPI

**Plataforma Next | Monitoreo Vehicular y Gestión de Flotas**

---

## 1. Identificación del proyecto

| Campo | Valor |
|-------|-------|
| **Nombre del proyecto** | NextAPI |
| **Descripción** | Backend de la plataforma Next — sistema maestro (Source of Truth) de monitoreo vehicular y gestión integral de flotas |
| **Versión del documento** | 1.9 |
| **Fecha de vigencia** | Marzo 2026 (logs obligatorios en partes cruciales por módulo — Nest `Logger`; sin secretos en log; referencia Auth) |

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
| **Auth** | Login (`token`, `refreshToken`, `expiresIn`), perfil vía `GET /login/me` (JWT), login por PIN (`POST /login/operador/accesso/nip` → `accessToken`), recuperación (respuesta genérica), confirmación, cambio de contraseña (revoca refresh token), `POST /login/refresh` (retorna `token` y `accessToken`; refresh almacenado con SHA256 en BD), `POST /login/logout`, verificación (código 6 dígitos, intentos limitados), rate limiting por usuario (variables `THROTTLE_*`). **Logs** en puntos críticos (`Logger` en servicio, controlador y estrategia JWT; ver §5). | `/api/login` |
| **Clientes** | ABM, jerarquía padre-hijo, listas paginadas y sin paginar. **`POST /` y `PATCH /:id`** consumen **`multipart/form-data`**: subida vía `S3Service` a carpeta `clientes`, `idModule` Clientes. En **creación**, son **obligatorios** `actaConstitutiva`, `comprobanteDomicilio` y `constanciaSituacionFiscal` (cada uno como **URL en texto** o **archivo PDF** en el mismo nombre de campo). **Logotipo** opcional (PNG/JPEG). Validación MIME **por campo** en el módulo Clientes (no reglas de negocio en S3). Ver §6.5 y `docs/FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md`. | `/api/clientes` |
| **Usuarios** | ABM; **`POST /` y `PATCH /:id`** con cuerpo **`application/json`** (`CreateUsuarioDto` / `UpdateUsuarioDto`). Campo **`fotoPerfil`** opcional como **URL**; imagen vía **`POST /api/s3/upload`** (`folder=usuarios`, `idModule=2`). Contraseña propia, NIP. Ver §6.6. *Guía de diseño* (multipart no implementado en API): `docs/FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md`. | `/api/usuarios` |
| **Roles** | ABM de roles del sistema | `/api/roles` |
| **Permisos** | ABM, permisos agrupados por usuario | `/api/permisos` |
| **Modulos** | ABM del catálogo de módulos | `/api/modulos` |
| **Bitácora** | Consulta de auditoría de acciones | `/api/bitacora` |
| **S3** | Subida (`POST /upload`), reemplazo (`PATCH /update`: nuevo archivo + borrado opcional de `oldUrl` en segundo plano), eliminación (`DELETE /delete` por URL). Tipos aceptados en el servicio genérico: `image/png`, `image/jpeg`, `image/jpg`, `application/pdf`; límite `UPLOAD_MAX_SIZE`. JWT obligatorio; roles 1, 2, 3; `idUsuario` en bitácora desde token. Carpetas: clientes, operadores, usuarios, vehiculos, pasajeros. Swagger documentado. | `/api/s3` |
| **Catálogos** | 20 catálogos (CatCategoriaLicencia, CatEstatus*, CatMarca*, CatModelo*, etc.) — Patrón Auranet en `src/catalogos/`, CRUD estándar por prefijo, Bitácora, soft delete; **endpoint unificado** `GET /api/catalogos/:nombreCatalogo` (ej: `cat-tipo-combustible`) | `/api/cat-*`, `/api/catalogos/:nombre` |
| **Sims** | ABM de tarjetas SIM (multitenancy, ICC único) | `/api/sims` |
| **Dispositivos** | ABM de dispositivos GPS (multitenancy, NumeroSerie único) | `/api/dispositivos` |
| **Operadores** | ABM de conductores (1:1 con Usuario, CURP/NSS únicos por cliente, documentos). Primera licencia obligatoria al crear; respuestas incluyen licencias vinculadas. | `/api/operadores` |
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
| **Observabilidad** | Cada módulo Nest debe incorporar **registro de logs** (`Logger` de `@nestjs/common`) en las **partes cruciales** de su flujo: entradas a operaciones relevantes, rechazos de reglas de negocio, finalizaciones exitosas y errores no controlados (mensaje y stack cuando aplique). El contexto del logger debe ser el **nombre de la clase** (p. ej. `AuthService`, `VehiculosService`). **Queda explícitamente prohibido** escribir en logs: contraseñas, PIN, refresh/access tokens completos, secretos de correo o códigos de verificación en claro. Los controladores pueden registrar solo metadatos HTTP seguros (ruta, `userId`, presencia de query params) sin duplicar datos sensibles del body. **Referencia:** módulo `Auth` (`auth.service.ts`, `auth.controller.ts`, `jwt.strategy.ts`). |

### 5.1 Bitácora vs logs de aplicación

- **Bitácora (`BitacoraLoggerService`):** auditoría de negocio persistida en BD para acciones acordadas (altas, bajas lógicas, cambios relevantes).
- **Logs (`Logger`):** trazabilidad operativa en consola/archivo según despliegue; complementan la bitácora y facilitan diagnóstico en tiempo real. Ambos son obligatorios donde el contrato ya exige bitácora; los logs por módulo se exigen **además** en los puntos críticos descritos en la tabla anterior.

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
- **Flujo cliente post-login:** `POST /login` → `{ token, refreshToken, expiresIn }`; `POST /login/operador/accesso/nip` → `{ accessToken, refreshToken, expiresIn }`; renovar sesión con **`POST /login/refresh`** (body `{ refreshToken }`) → `{ token, accessToken, expiresIn }` (compatibilidad). El refresh token se almacena con SHA256 en BD; cerrar sesión con **`POST /login/logout`** (JWT Bearer); datos de usuario y permisos vía **`GET /login/me`**; cambio de contraseña revoca el refresh token del usuario.
- **Recuperación de contraseña:** respuesta HTTP siempre la misma (no revela si el correo existe); límite interno por usuario/correo
- **Verificación de cuenta:** código numérico de **6 dígitos**, vigencia y contador de intentos fallidos (tabla `CodigoAutenticacion`)
- Roles de referencia: `1=SuperAdministrador`, `2=Administrador`, `3=Monitorista` (ver implementación vigente de guards y permisos por módulo)

### 6.3 Documentación

- Swagger disponible en `/api/docs`
- Servidores: `http://localhost:3010`, `https://springtelecom.mx/nextAPI`

### 6.4 Almacenamiento S3 (API)

| Elemento | Especificación |
|----------|----------------|
| **Autenticación** | JWT Bearer en todos los endpoints; `idUsuario` para bitácora solo desde `req.user.userId` (no por body/query) |
| **Guards** | `JwtAuthGuard`, `RolesGuard`, `@Roles(1, 2, 3)` |
| **POST /api/s3/upload** | `multipart/form-data`: `file`, `folder`, `idModule`. Respuesta `{ url }` |
| **PATCH /api/s3/update** | `multipart/form-data`: `file`, `folder`, `idModule`, `oldUrl` opcional. Sube primero; si hay `oldUrl`, elimina el objeto anterior en S3 sin bloquear la respuesta. Respuesta `{ url }` |
| **DELETE /api/s3/delete** | Body JSON: `fileUrl`, `idModule`. Respuesta `{ deleted, key? }` |
| **folder** | Valores permitidos: `clientes`, `operadores`, `usuarios`, `vehiculos`, `pasajeros` |
| **Tipos MIME** | `image/png`, `image/jpeg`, `image/jpg`, `application/pdf` (validación genérica del `S3Service`; restricciones por dominio, p. ej. PDF vs imagen en Clientes, en el módulo correspondiente) |
| **Tamaño** | Máximo según variable `UPLOAD_MAX_SIZE` (bytes) |
| **Bitácora** | CREATE en subidas; DELETE en borrados exitosos y errores; registro adicional si falla el borrado del archivo anterior en `update` |
| **Referencia** | `docs/FLUJO-MEJORA-S3-UPDATE-DELETE.md` |

### 6.5 Clientes — creación y actualización con documentos (multipart)

| Elemento | Especificación |
|----------|----------------|
| **Autenticación** | JWT Bearer; `JwtAuthGuard`, `RolesGuard` (según `ClientesController`) |
| **POST /api/clientes** | `Content-Type: multipart/form-data`. Campos de texto según `CreateClienteDto` (`rfc`, `tipoPersona`, etc.). Archivos opcionales de clave: `actaConstitutiva`, `comprobanteDomicilio`, `constanciaSituacionFiscal`, `logotipo`. **Obligatorios en creación** los tres documentos: cada uno debe llegar como **parte de archivo PDF** y/o **campo de texto con URL** (flujo híbrido); el servicio valida que exista URL final tras subida. **Logotipo** solo imagen (PNG/JPEG). Límite de tamaño por archivo: `UPLOAD_MAX_SIZE` (Multer + validación en `S3Service`). |
| **PATCH /api/clientes/:id** | Mismo `multipart/form-data`; actualización parcial. Si se envía un archivo nuevo para un documento o logo, se usa `S3Service.updateFile` (sube y borra `oldUrl` en segundo plano cuando aplique). |
| **Carpeta S3** | Prefijo `clientes` (misma convención que `POST /api/s3/upload` con `folder=clientes`). |
| **Bitácora módulo Clientes** | Operaciones de negocio en Clientes según reglas existentes; subidas registradas también desde `S3Service` con `EnumModulos.CLIENTES`. |
| **Regla de diseño** | La **Separación MIME por campo** (PDF en acta/comprobante/constancia; imagen en logotipo) se implementa en **Clientes** (`FileFieldsInterceptor` / DTO / servicio), no como política específica dentro del módulo S3. |
| **Referencia** | `docs/FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md` |

**Nota de compatibilidad:** `POST /` y `PATCH /:id` de Clientes **no** aceptan `application/json` para el cuerpo principal del create/update con esta implementación; integraciones que sólo envíen JSON deben usar el flujo alterno (p. ej. `POST /api/s3/upload` y luego persistir URLs) o adaptarse a multipart.

### 6.6 Usuarios — creación y actualización (JSON)

| Elemento | Especificación |
|----------|----------------|
| **Autenticación** | JWT Bearer; `JwtAuthGuard`, `RolesGuard` (según `UsuariosController`) |
| **POST /api/usuarios** | **`application/json`**. Cuerpo según `CreateUsuarioDto` (incl. `permisosIds`, hash de contraseña en claro para reglas de validación, etc.). **`fotoPerfil`** opcional: string con **URL** ya subida (flujo típico: `POST /api/s3/upload` con `folder=usuarios`, `idModule=2`). |
| **PATCH /api/usuarios/:id** | **`application/json`** parcial según `UpdateUsuarioDto`; misma convención para **`fotoPerfil`** como URL si se actualiza la imagen. |
| **Estatus** | Puede incluirse en el JSON del DTO según reglas vigentes; también **`PATCH /api/usuarios/estatus/:id`** para cambio explícito de estatus. |
| **Referencia de diseño (no normativa de API)** | `docs/FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md` describe un patrón *multipart* alineado a Clientes; **la API entregada** para alta/edición de usuario sigue siendo **JSON** salvo addendum. |

### 6.7 Catálogos — Patrón Auranet

Los 20 catálogos están agrupados en `src/catalogos/`. `CatalogosModule` importa los submódulos, expone `CatalogosRegistry` y `CatalogosService`, y ofrece:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/catalogos/:nombreCatalogo` | Lista completa del catálogo por nombre (ej: `cat-tipo-combustible`). Requiere JWT Bearer. |

Además, cada catálogo mantiene sus rutas CRUD bajo `/api/cat-*` (ver sección siguiente).

### 6.8 Convenciones para módulos de catálogo (Cat)

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
| **Logs** | `Logger` de Nest en el **servicio** (y si aplica en el controlador) en operaciones críticas, alineado a §5 |
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

- [x] Login y autenticación JWT operativos (`POST /login` retorna `token`; PIN retorna `accessToken`; refresh retorna `token` y `accessToken`; perfil en `GET /login/me`; `POST /login/refresh`, `POST /login/logout`)
- [x] Endurecimiento Auth: rate limiting por usuario (THROTTLE_*), mensajes genéricos en login/recuperación/verify, códigos 6 dígitos
- [x] CRUD de Clientes, Usuarios, Roles, Permisos, Modulos (Clientes: `multipart/form-data` en alta/edición, documentos obligatorios en alta, S3 `clientes`; Usuarios: JSON en alta/edición, `fotoPerfil` como URL y S3 `usuarios` vía API genérica)
- [x] Bitácora de auditoría consultable
- [x] Archivos en S3: subida, actualización (reemplazo con borrado opcional del anterior) y eliminación por URL; bitácora; documentación Swagger del módulo S3
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
| Flujos de implementación | `docs/FLUJO-*.md` | Clientes multipart (`FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md`); Usuarios foto/guía (`FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md`); S3 (`FLUJO-MEJORA-S3-UPDATE-DELETE.md`); catálogos (Cat*); módulos operativos |
| Seguridad Auth | `docs/FLUJO-SEGURIDAD-AUTH.md`, `docs/SEGURIDAD-LOGIN-NEXTAPI.md` | Hardening login, verify, recuperación |

---

## 12. Aceptación

El presente contrato constituye el acuerdo técnico entre las partes para el proyecto NextAPI. Cualquier modificación al alcance o especificaciones deberá documentarse por escrito (addendum) y ser aceptada por ambas partes.

---

*Alineado con `docs/CONTEXTO-PROYECTO.md` (marzo 2026). **v1.8:** alineación Auth (`token` en login estándar, `accessToken` en PIN y compatibilidad en refresh), ajuste de bloque de roles de referencia, conservación de Clientes multipart y Usuarios JSON. **v1.7:** §6.6 Usuarios en JSON + foto por URL/S3 genérico; aclaración de guía `FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md`. **v1.6:** Clientes `POST/PATCH` multipart, documentos obligatorios, MIME por campo en Clientes, S3 con `image/jpg`. **v1.5:** S3 upload/update/delete, JWT, bitácora, Swagger. Ver `docs/FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md`, `docs/FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md`, `docs/FLUJO-MEJORA-S3-UPDATE-DELETE.md`, `docs/FLUJO-MODULO-OPERADORES.md`, `docs/FLUJO-REFRESH-TOKEN.md`.*

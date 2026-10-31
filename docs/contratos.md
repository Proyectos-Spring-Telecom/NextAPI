# Contratos — NextAPI

Documento **único** de contratos del backend NextAPI: alcance del proyecto, principios, especificaciones de API (Auth, S3, Clientes, Usuarios, Catálogos), y contratos operativos de **Monitoreo**, **AMQP**, **Sockets**, **Alarmas** y **Webhooks**.

Complementa [`contexto.md`](./contexto.md) (visión y flujos). Swagger: `/docs` (fuera del prefijo `/api`).

**Versión:** 3.1 · **Fecha:** 2026-10-03

Autenticación general (salvo ingest HMAC / health):  
`Authorization: Bearer <accessToken|token>`.

---

## 1. Identificación y objeto

| Campo | Valor |
|-------|-------|
| **Nombre** | NextAPI (`package.json` 2.2.0) |
| **Descripción** | Backend NestJS de la plataforma **Next** — Source of Truth de monitoreo vehicular y gestión de flotas |
| **BD** | MySQL 8 — esquema `Next` |
| **Servidores** | Local `http://localhost:3004` · Spring `https://springtelecom.mx/nextAPI` |

NextAPI es el único lugar donde se crean, modifican y dan de baja (soft delete) los datos maestros: clientes, usuarios, productos, instalaciones, dispositivos, posiciones, alarmas de panel e incidentes. Los consumidores (ShiftControl, springTrackCam, App Operador, front) usan REST, Socket.IO o webhooks HMAC; **no** escriben en la BD `Next`.

---

## 2. Stack tecnológico

| Capa | Tecnología | Estado |
|------|------------|--------|
| Backend | NestJS 11 + TypeScript | Implementado |
| BD / ORM | MySQL 8 + TypeORM (`synchronize: false`) | Implementado |
| Auth | JWT Passport + refresh (SHA256 en BD) | Implementado |
| Rate limiting | `@nestjs/throttler` global (100 req / 60 s por usuario) + límites Auth `THROTTLE_*` | Implementado |
| Tiempo real | Socket.IO (`/monitoreo`, `/alarmas`) | Implementado |
| Mensajería | RabbitMQ AMQP — colas AVL (JT808 + Jimi + FA100S) y AX PRO | Implementado |
| Observabilidad colas | `GET /health/rabbitmq` + `GET /health/rabbitmq/queues` | Implementado |
| Storage / Mail | AWS S3 / Nodemailer | Implementado |
| Docs API | Swagger `/docs` | Implementado |
| Pruebas | Jest + ts-jest (unitarias de messaging, utilidades y órdenes de servicio) + batería de punta a punta de órdenes (`npm run test:e2e-ordenes`) | Implementado |
| Docker / Nginx / K8s | Infra de despliegue | Fuera de alcance API (addendum) |

---

## 3. Principios arquitectónicos

| Principio | Aplicación |
|-----------|------------|
| **Source of Truth** | Solo NextAPI muta datos maestros |
| **Database per Service** | BD `Next` exclusiva; nadie más escribe directo |
| **Clean layers** | Controller → Service → Repository / Query |
| **Multitenancy** | `IdCliente` + filtros por rol / `TenantFilterService` |
| **API-first** | Prefijo `/api`; respuestas consistentes (ver §4) |
| **Desconocimiento** | Emite webhooks; no importa módulos de consumidores |
| **Observabilidad** | `Logger` Nest en puntos críticos + bitácora de negocio. **Prohibido** loguear contraseñas, PIN, tokens completos, secretos o códigos de verificación en claro |

**Bitácora vs logs:** bitácora = auditoría en BD; `Logger` = trazabilidad operativa. Ambos donde el módulo ya exige bitácora.

---

## 4. Convenciones de API

### 4.1 Respuestas

| Tipo | Shape |
|------|--------|
| Lista | `{ data: [] }` |
| Paginada `GET /:page/:limit` | `{ data: [], paginated: { total, page, limit, totalPages } }` |
| CRUD helpers | `ApiCrudResponse` / `ApiResponseCommon` |
| Monitoreo list / consola | `{ posicion: [...] }` (**sin** wrapper `data`) |
| Monitoreo histórico | `{ totalDistancia, posiciones: [...] }` |
| Errores | `{ statusCode, message, error }` |

Campos **camelCase**. Soft delete: `Estatus` 0/1; no DELETE físico en catálogos/recursos (excepción: `DELETE /geocercas/:id`).

### 4.2 Seguridad

- Guards: `JwtAuthGuard`, `RolesGuard`, `@Roles()`
- `ThrottlerGuard` global (`APP_GUARD`) + límites por endpoint en Auth (`THROTTLE_*`)
- Login: fallo unificado `401` (sin enumeración de usuarios)
- Roles de referencia (`EnumRoles`): `1` SA, `2` Dev, `3` Admin, `4` Jefe de monitoreo, `5` Monitoreo, `6` Cliente, `7` Operador, `8` Técnico, `9` Usuario. `@Roles()` vacío = cualquier usuario autenticado
- `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` (campos no declarados → 400)
- CORS `origin: '*'`, `credentials: true`
- Endpoints públicos (sin JWT): `POST /login` y flujos de recuperación, ingest HMAC de alarmas, integración HMAC del CRM (`/integracion/*`, §14.1), `GET /health/rabbitmq`, `GET /health/rabbitmq/queues`

### 4.3 Soft delete y bitácora (Cat / recursos)

- `PATCH /estatus/:id` para activar/desactivar
- Bitácora en create / update / delete lógico
- Logs en servicio (y controlador si aplica) en operaciones críticas

---

## 5. Auth

Base: `/login` (+ `/auth` para facial) · Tag Swagger Autenticación.

| Endpoint | Uso / respuesta |
|----------|-----------------|
| `POST /login` | Body `{ userName, password }` (query `Nombres` = solución, default `NXT`) → `{ token, refreshToken }` |
| `POST /login/operador/accesso/nip` | `{ accessToken, refreshToken, expiresIn }` |
| `POST /login/refresh` | Body `{ refreshToken }` → `{ token, refreshToken }` (rota el refresh) |
| `POST /login/logout` | JWT Bearer; revoca refresh |
| `GET /login/me` | Perfil + permisos |
| `PATCH /login/verify` | Verificación con código |
| `POST /login/usuario/recuperar/acceso` | Recuperación de contraseña (Next) |
| `POST /login/usuario/solicitud/recuperacion` | Recuperación de contraseña (Shift) |
| `POST /login/recuperar/confirmacion`, `POST /login/cambiar/accesso` | Confirmación y cambio de contraseña |
| `POST /auth/validateFace` | Login por reconocimiento facial (BehaviorIQ) |

Recuperación: respuesta genérica; código 6 dígitos; intentos limitados.

---

## 6. S3

Base: `/s3` · Cualquier usuario autenticado (`@Roles()` vacío).

| Método | Spec |
|--------|------|
| `POST /upload` | multipart: `file`, `folder`, `idModule` → `{ url }` |
| `PATCH /update` | multipart: `file`, `folder`, `idModule`, `oldUrl?` → `{ url }` |

**folder:** `clientes`, `operadores`, `usuarios`, `vehiculos`, `pasajeros`.  
**MIME genérico:** png/jpeg/jpg/pdf. Límite: `UPLOAD_MAX_SIZE`.  
`idUsuario` de bitácora solo desde JWT.

> `DELETE /s3/delete` **no** está expuesto en el controller actual (el texto del tag Swagger aún lo menciona).

---

## 7. Clientes (multipart)

| Elemento | Spec |
|----------|------|
| `POST /`, `PATCH /:id` | `multipart/form-data` (no JSON como cuerpo principal) |
| Obligatorios en alta | `rfc`, `tipoPersona`, `numerosEmergencia` |
| Documentos en **alta** | **Opcionales**: `actaConstitutiva`, `comprobanteDomicilio`, `constanciaSituacionFiscal` (PDF archivo y/o URL texto, máx. 500 caracteres como URL) |
| `logotipo` | Opcional PNG/JPEG |
| MIME por campo | En módulo Clientes, no en S3 genérico |
| Carpeta S3 | `clientes` |
| Otras rutas | `GET /list`, `GET /jerarquia` (`spGetClientes`), `GET /list/:cliente`, `GET /:page/:limit`, `GET /:id`, `PATCH /estatus/:id` |

---

## 8. Usuarios (multipart)

| Elemento | Spec |
|----------|------|
| `POST /`, `PATCH /:id` | `multipart/form-data` |
| `permisosIds` | Obligatorio en alta (puede ser `[]`) → `UsuariosPermisos` |
| `solucionesIds` | Opcional → `AsignacionSoluciones` |
| Arreglos | JSON en texto (`"[1,2,3]"`) |
| `fotoPerfil` | Opcional: URL en texto o archivo PNG/JPEG |
| Rol automático | Si crea un Cliente (6) o Usuario (9), el nuevo usuario recibe rol 9 (`idRol` del body se ignora) |
| `POST /asignacion/instalaciones` | Sincroniza `UsuariosInstalaciones` del `idUsuario` (`[]` desactiva todas); instalaciones activas y del mismo cliente |
| `GET /:id/instalaciones` | Instalaciones asignadas |
| `POST /face-auth` | Registra `IdFaceAuth` del usuario del token (409 si ya tiene) |
| `PATCH /actualizar/contrasena`, `POST /cambiar/accesso` | Cambiar mi contraseña / cambiar sin contraseña actual |
| `PATCH /mi-nip` | Crear o actualizar mi NIP |
| Listados | `GET /list`, `GET /list/cliente/:id` (403 fuera de alcance), `GET /:page/:limit`, `GET /:id` |
| Estatus | `PATCH /estatus/:id` |

---

## 9. Catálogos

- Patrón NextAPI: `src/catalogos/` padre + submódulos + registry.
- Unificado: `GET /catalogos/:nombreCatalogo`.
- Catálogos registrados (5): `cat-tipo-combustible`, `cat-telefonia`, `cat-planes-telefonia`, `cat-marcas`, `cat-modelos`.
- CRUD por prefijo `/cat-*`:

| Ruta | Uso |
|------|-----|
| `GET /list` | Lista (`soloActivos` opcional) |
| `GET /:page/:limit` | Paginada |
| `GET /:id` | Por ID |
| `POST /` | Crear |
| `PATCH /:id` | Actualizar |
| `PATCH /estatus/:id` | Soft delete / reactivar |

Extras: `GET /cat-marcas/:id/modelos`, `GET /cat-telefonia/:idTelefonia/planes`, `GET /cat-telefonia` y `GET /cat-planes-telefonia` (filtros + paginación).

---

## 10. Inventario de endpoints (prefijo `/api`)

| Módulo | Rutas |
|--------|-------|
| Auth | §5 |
| Bitácora | `GET /bitacora/:page/:limit`, `GET /bitacora/:id` (`GET /bitacora/list` obsoleto) |
| Clientes | §7 |
| Usuarios | §8 |
| Roles | `POST /roles`, `GET /roles/list` (según visibilidad del rol del token), `GET /roles/:page/:limit`, `GET /roles/:id`, `PUT /roles/:id`, `PATCH /roles/estatus/:id` |
| Permisos | `POST /permisos`, `GET /permisos/list`, `GET /permisos/:page/:limit`, `GET /permisos/permisosAgrupados` (§10.1), `GET /permisos/:id`, `PUT /permisos/:id`, `PATCH /permisos/:id/estatus` |
| Módulos | `POST /modulos`, `GET /modulos/list`, `GET /modulos/:page/:limit`, `GET /modulos/:id`, `PUT /modulos/:id`, `PATCH /modulos/:id/estatus` |
| S3 | §6 |
| Catálogos | §9 |
| Sims | `POST /sims`, `GET /sims/list`, `GET /sims/:page/:limit`, `GET /sims/:id`, `PATCH /sims/estatus/:id`, `PATCH /sims/:id` (cambiar plan/teléfono, IMEI, cliente, compañía) |
| Dispositivos | §14 |
| Órdenes de servicio | `GET /ordenes-servicio/catalogo`, `GET /ordenes-servicio/paginado/:page/:limit`, `POST /ordenes-servicio`, `PATCH /ordenes-servicio/:id`, `POST /ordenes-servicio/:id/archivos/:clave`, `POST /ordenes-servicio/:id/cerrar`, `POST /ordenes-servicio/:id/cancelar`, `GET /ordenes-servicio/:id`; etapas 2–3 y remediación: `GET …/motivos`, `GET …/codigos-pendientes`, `GET …/autorizaciones-pendientes`, `GET …/pruebas-pendientes`, `POST …/programar`, `PATCH …/:id/reprogramar`, `POST …/:id/iniciar`, `POST …/:id/codigo`, `POST …/:id/codigo/ver`, `POST …/:id/codigo/validar`, `POST …/:id/codigo/reiniciar`, `POST …/:id/autorizacion`, `POST …/:id/autorizacion/decision`, `POST …/:id/pruebas/:clave/solicitar`, `POST …/:id/pruebas/:clave/validar`, `POST …/:id/no-cumplida`, `GET …/:id/pdf`, `POST …/:id/compartir`, `POST …/:id/enviar-correo` (§14.1) |
| Integración CRM (HMAC) | `GET /integracion/clientes`, `GET …/clientes/:id`, `POST …/clientes`, `GET …/tecnicos`, `GET …/unidades`, `GET …/unidades/conteo`, `GET …/sims`, `GET …/ordenes-realizadas`; `GET /integracion/ordenes-servicio/cambios`, `GET …/por-referencia/:referencia`, `GET …/motivos`, `GET …/autorizaciones-pendientes`, `POST /integracion/ordenes-servicio`, `PATCH …/:id`, `POST …/:id/cancelar`, `POST …/:id/autorizacion/decision` ([ordenes-servicio.md §12.9 y §14](ordenes-servicio.md)) |
| Telemetría – equipos sin alta | `GET /telemetria/huerfanos/:page/:limit?protocolo=jt808\|jimi\|axpro\|fa100s&horas=N`, `DELETE /telemetria/huerfanos/:id` (roles 1–3; §12.6) |
| Operadores | §10.2 |
| Productos | `GET /productos/list`, `GET /productos/paginado/:page/:limit`, `GET /productos/cliente/:idCliente`, `GET /productos/:id`, `PATCH /productos/estatus/:id`, `PATCH /productos/:id` (nombre) |
| Vehículos | `POST /productos/vehiculos`, `GET …/list`, `GET …/placa/:placa`, `GET …/:page/:limit`, `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Activos / Inmuebles / Personas | `POST /productos/{activos\|inmuebles\|personas}`, `GET …/list`, `GET …/:page/:limit`, `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Instalaciones | `POST /instalaciones`, `GET …/list`, `GET …/list/tipo/:idTipoProducto`, `GET …/cliente/:idCliente`, `GET …/historico/:id`, `POST …/paginado` (por tipo de producto), `GET …/:id` (detalle completo), `PATCH …/estatus/:id`, `PATCH …/:id` (archiva + nueva versión) |
| Monitoreo | §11 |
| Alarmas | §13 |
| Incidentes | `POST /incidentes`, `GET …/list` (abiertos), `GET …/cliente/:idCliente`, `GET /incidentes` (paginado), `PATCH …/:id/finalizar`, `GET …/:id/seguimientos`, `POST …/:id/seguimientos`, `GET …/:id`, `PATCH …/estatus/:id` (abierto ↔ cerrado), `PATCH …/:id` |
| Geocercas | `POST /geocercas`, `GET …/list`, `GET /geocercas` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id`, `DELETE …/:id` (físico) |
| Puntos de interés | `POST /puntos-interes`, `GET …/list`, `GET …/cliente/:idCliente`, `GET /puntos-interes` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Números de emergencia | `POST /numeros-emergencia`, `GET …/list`, `GET …/cliente/:idCliente`, `GET /numeros-emergencia` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Reportes | `POST /reportes/paso-por-poi`, `POST /reportes/velocidad`, `POST /reportes/posiciones`, `POST /reportes/ultima-posicion`, `POST /reportes/distancia` (Haversine por IMEI), `POST /reportes/salidas-geocerca`, `POST /reportes/salidas-geocerca-instalacion`, `POST /reportes/salidas-geocerca-instalacion/recorrido`, `POST /reportes/productos-cliente` (productos con su última ubicación) |
| Consola | `GET /consola/galeria/filtros`, `POST /consola/galeria/resumen`, `POST /consola/galeria`, `POST /consola/galeria/imei`, `POST /consola/transmisiones` (últimas transmisiones por IMEI), `POST /consola/sin-transmision` (unidades sin transmitir en N días) |
| Dashboard | `GET /dashboard` (inicio · centro de mando) |
| Health | `GET /health/rabbitmq`, `GET /health/rabbitmq/queues` (§12.5) |

### 10.1 `GET /permisos/permisosAgrupados`

Permisos del usuario del token, agrupados por módulo, más sus soluciones asignadas:

```json
{
  "UsuariosPermisos": [ ],
  "AsignacionSoluciones": [ ]
}
```

Ya **no** incluye `UsuarioPanelAlarma` (tabla inexistente) ni `UsuariosInstalaciones`.

### 10.2 Operadores y licencias (multipart)

| Ruta | Spec |
|------|------|
| `POST /operadores` | Crea operador (1:1 Usuario; `IdCliente` del usuario). `identificacion` y `licencia` obligatorias (URL o PNG/JPEG/PDF); foto, comprobante, certificado médico y antecedentes opcionales. Incluye la primera licencia |
| `POST /operadores/:idOperador/licencias` | Licencia adicional; documento `licencia` obligatorio. Única por tipo por operador y por número global (400 duplicado, 404 operador) |
| `PATCH /operadores/licencias/:id` | Actualización parcial; un archivo nuevo reemplaza en S3 |
| `PATCH /operadores/licencias/estatus/:id` | Alterna 1 ↔ 0 (sin body) |
| `GET /operadores/list` | Activos, alcance por rol, shape plano |
| `GET /operadores/:page/:limit`, `GET /operadores/:id`, `PATCH /operadores/:id`, `PATCH /operadores/estatus/:id` | CRUD |

---

## 11. Monitoreo

Base: `/monitoreo` · Tag Swagger `Monitoreo`.

### 11.1 `GET /monitoreo/list`

| Rol | Alcance |
|-----|---------|
| SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8) | Todas activas |
| Cliente (6) | Cliente + descendientes |
| Operador (7), Usuario (9) | `UsuariosInstalaciones` (activas) |

**Respuesta:** `{ "posicion": [ ... ] }` (plano, camelCase).

#### Shape GPS (tipos producto 1, 2, 4)

Contexto del producto + campos de `UltimaPosicion` (null si no hay fila):

| Campo | Origen |
|-------|--------|
| `idInstalacion`, `idCliente`, `idTipoProducto` | Instalación / producto |
| `idTipoDispositivo`, `codigoTipoDispositivo`, `nombreTipoDispositivo` | `CatTipoDispositivo` |
| `cliente`, `placa` / `descripcion` / `persona`, `economico`, `marca`, `modelo`, … | Contexto por tipo |
| `imei`, `lat`, `lng`, `estado`, `fechaHora`, `velocidad`, `direccion`, `odometro`, `ignicion`, `alarma1`, `alarma2`, `energia`, `idEvento`, `idFoto`, `fhRegistro`, `bateria`, `alimentacion`, `gps`, `gsm`, `movimiento`, `combustible`, `nivelCombustible` | `UltimaPosicion` |
| `id` | `UltimaPosicion.Id` |

**No se exponen** en listado/socket: `idFoto1..3`, `idVideo1..3`, `rutaFoto*`, `rutaVideo*`.

#### Shape inmueble / panel (tipo 3)

Sin `UltimaPosicion`. Incluye `lat`/`lng` del inmueble, `ultimoHeartbeat`, `fechaHora`, `ultimoEventoAlarma`.

### 11.2 `GET /monitoreo/consola`

Filas de `UltimaPosicion` (plano, camelCase) ordenadas por `fechaHora` DESC, con el mismo alcance por rol que `list`. Contexto mínimo: `idInstalacion`, `idCliente`, `idDispositivo`.  
**Respuesta:** `{ "posicion": [ ... ] }`.

### 11.3 `POST /monitoreo/instalaciones-usuarios`

Body `{ idCliente, idUsuarios: number[] }` (mín. 1). Devuelve las instalaciones activas del cliente asignadas en `UsuariosInstalaciones` a esos usuarios. Los usuarios deben ser del mismo cliente (400) y el cliente debe estar en el alcance del token (403).

### 11.4 Socket.IO — `/monitoreo`

| Evento | Dirección | Payload |
|--------|-----------|---------|
| Auth | Cliente → server | JWT en `auth.token` / `Authorization` / query |
| `conexion:lista` | Server → cliente | `{ idsInstalaciones, posicion[] }` (mismo shape que list) |
| `conexion:consola` | Server → cliente | `{ posicion[] }` (mismo shape que `GET /monitoreo/consola`) |
| `monitoreo:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano (listado) |
| `consola:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano de `UltimaPosicion` (consola) |

Se emite tras ingest GPS (`notificarImei`) o cambios de dispositivo / instalación / panel relevantes.

### 11.5 `GET /monitoreo/:idInstalacion/historico`

Query: `fechaInicio`, `fechaFinal` (`YYYY-MM-DD HH:mm:ss`, hora de pared).

- **No aplica** a inmueble/panel (`400`).
- Lee `Posiciones` por IMEI; orden DESC.
- `totalDistancia` Haversine entre **todos** los puntos consecutivos (sin filtrar saltos, drift ni coordenadas).

**Respuesta:** `{ totalDistancia, posiciones: [...] }` — ítems con columnas de `Posiciones` + `rutaFoto` / `rutaFoto1..3` / `rutaVideo1..3`.

### 11.6 `POST /monitoreo/:idInstalacion/foto`

Proxy a springTrackCam `POST /gateway/photo/start`.

**Precondiciones:** instalación activa, dispositivo TRACKCAM (código / id 5), `NumeroSerie` + `Imei` válidos. Reenvía JWT.

**Body opcional:** `{ "channelId": 1 }` (`1`–`4` en el DTO de NextAPI; si falta → canales activos del registry).

Gateway: `terminalId` (NumeroSerie pad 12), `imei`, `saveFlag: 0`, `channelId?`.  
**No** INSERT local; media vía AMQP. Timeout proxy: **90 s**. Errores: 400 / 404 / 409 (cámara offline) / 504 (timeout).

### 11.7 `POST /monitoreo/:idInstalacion/video`

Proxy a `POST /gateway/video/capture`.

**Body opcional:** `{ "durationSeconds": 15, "channelId": 2 }` — default duration 30 (máx. 30); `channelId` `1`–`4`.

Timeout: **90 s** (1 canal) / **150 s** (multi).

---

## 12. AMQP (AVL / AX PRO)

Exchange: `telemetry` (topic). DLX: `telemetry.dlx`. Prefijo código: `src/messaging/`.

| Grupo | Cola | Bindings | DLQ (routing key) |
|-------|------|----------|-------------------|
| AVL posiciones (JT808 + Jimi + FA100S) | `telemetry.avl.events` | `jt808.position`, `jimi.position`, `fa100s.position` | `telemetry.avl.dlq` (`telemetry.avl.failed`) |
| AVL alarmas (JT808 + Jimi + FA100S) | `telemetry.avl.alarms` | `jt808.alarm.*`, `jimi.alarm.*`, `fa100s.alarm.*` | `telemetry.avl.dlq` (`telemetry.avl.failed`) |
| AX PRO eventos | `telemetry.axpro.events` | `axpro.event` | `telemetry.axpro.dlq` (`telemetry.axpro.failed`) |
| AX PRO heartbeats | `telemetry.axpro.heartbeats` | `axpro.heartbeat` | `telemetry.axpro.dlq` (`telemetry.axpro.failed`) |

Colas retiradas (ya sin consumer): `telemetry.jt808.events`, `telemetry.jimi.events`, sus DLQ y `telemetry.jt808.media`.

### 12.1 Envelope JT808 / Jimi

```json
{
  "eventId": "<sha256-hex-64>",
  "protocol": "jt808|jimi",
  "kind": "position|alarm",
  "deviceId": "<NumeroSerie o IMEI Concox>",
  "receivedAt": "2026-09-03T23:30:00.000Z",
  "payload": { }
}
```

- Headers: `protocol` y `kind` (tienen prioridad sobre el body), `deviceId` opcional. `message_id` = `eventId`.
- `kind` debe coincidir con la cola (`position` → events, `alarm` → alarms; FA100S además acepta `alarm_location` en alarms); `protocol` ∉ {`jt808`, `jimi`, `fa100s`} → DLQ.
- **Jimi:** lookup `payload.Imei || deviceId` → `Dispositivos.Imei` (estatus 1 o 2). Alarm AMQP solo SOS (`jimi.alarm.*`).
- **FA100S (relojes, springFA100S):** lookup por `Dispositivos.Imei` (`deviceId` = IMEI de 15 dígitos; dar de alta el reloj como Rastreador). `position` → `Posiciones`; sin GPS llega con la última posición válida y `positionValid=false`. `alarm` (SOS 5, caída 35, pulsera 36, ritmo 37, batería 3) → auditoría; la alarma se ve por la posición con su `IdEvento` y `Estado=2`. `alarm_location` (por `fa100s.alarm.*`) corrige `Lat/Lng` de la posición de la alarma (mismo Imei, `FechaHora` e `IdEvento`) sin crear otra ni abrir otro incidente; si la alarma no llegó a `Posiciones`, se inserta. Sin alta → `TelemetryHuerfanos` (`protocol=fa100s`). Código: `src/messaging/fa100s/`.
- Payload Jimi position: `IdEvento` (number), `Lat`/`Lng` (number) y `FechaHora` (`YYYY-MM-DD HH:mm:ss` o `YYYY-MM-DDTHH:mm:ss`, hora de pared) obligatorios.

### 12.2 Publicador Server_Socket (`jimi.position`)

| Propiedad | Valor |
|-----------|-------|
| Exchange / routing key | `telemetry` / `jimi.position` (enruta a `telemetry.avl.events`) |
| Usuario AMQP | `avl` (vhost `/`) |
| `content_type` / `delivery_mode` | `application/json` / `2` |
| `message_id` | `eventId` |
| Headers | `protocol=jimi`, `kind=position`, `deviceId=<IMEI>` |
| `mandatory` | `true` (si no hay binding, el broker devuelve el mensaje) |

Ejemplo validado contra el código:

```json
{
  "eventId": "<sha256-hex-64>",
  "protocol": "jimi",
  "kind": "position",
  "deviceId": "950204084",
  "receivedAt": "2026-10-03T01:59:05.000Z",
  "payload": {
    "Imei": "950204084", "Lat": 18.926405, "Lng": -99.202765, "Estado": 1,
    "FechaHora": "2026-10-02 19:59:00", "Velocidad": 37, "Direccion": 191,
    "Odometro": null, "Ignicion": 1, "Alarma1": null, "Alarma2": null, "Energia": null,
    "IdEvento": 9, "IdFoto": 0, "Bateria": null, "Alimentacion": null, "GPS": null,
    "GSM": null, "Movimiento": 2, "Combustible": null,
    "Foto1": null, "Foto2": null, "Foto3": null, "Video1": null, "Video2": null, "Video3": null,
    "jimi": { "protocol": 160 }
  }
}
```

Recomendado: `eventId` determinista por posición (reenvío = duplicado); `receivedAt` en UTC real (no se persiste para Jimi).

### 12.3 Persistencia position (orden)

1. Idempotencia `eventId` (`TelemetryIngestLog`).
2. Lookup dispositivo → Imei.
3. `Foto1..3` → INSERT `Fotos` → ids.
4. `Video1..3` → INSERT `Videos` → ids.
5. INSERT `Posiciones` (Estado/Ignicion del payload; FKs media; **`IdFoto: null`**).
   - Geocerca → `Estado=8` (tipos 1/3/4/5/6; no pisa 2/3/10).
   - AVL/TRACKCAM/TRACKGAS + `Estado=0` + `Velocidad=0` → puede subir a 4/5/6.
6. Trigger BD → NULL + espejo `UltimaPosicion`.
7. Socket `monitoreo:actualizacion` + `consola:actualizacion`.

`payload.IdFoto` / `jt808.multimediaId` → solo `Fotos.IdFoto` (no FK de Posiciones).

**Orden por equipo (31/10/2026):** las posiciones y alarmas de un mismo equipo (`protocol|deviceId`) se procesan una a la vez y en el orden en que llegan; equipos distintos van en paralelo (`src/messaging/core/orden-por-equipo.ts`). Las reglas que comparan con la posición anterior (tiempo detenido, inicio de alerta, geocerca) ya no se calculan al revés. Prefetch AVL por omisión 50 (`RABBITMQ_PREFETCH_AVL`) para que el lote atrasado de un equipo no frene a los demás; la concurrencia a MySQL la limita `RABBITMQ_MAX_CONCURRENT_DB`. Un reintento por error temporal se vuelve a publicar al final de la cola y todavía puede quedar detrás de posiciones más nuevas del equipo.

### 12.4 Reintentos y DLQ

| Caso | Resultado |
|------|-----------|
| Éxito o duplicado | ack |
| Dispositivo desconocido | upsert en `TelemetryHuerfanos` + ack (no DLQ), ver §12.6 |
| MySQL no disponible (caído, reiniciando, `Server shutdown in progress`, `ECONNREFUSED`, `Too many connections`, `Pool is closed`) | **No gasta reintentos.** El mensaje se queda sin confirmar y todos los consumidores esperan (1 s, 2 s, 4 s… hasta `RABBITMQ_DB_RETRY_MAX_DELAY_MS`) a que MySQL vuelva; la cola absorbe lo que siga llegando. Si un mensaje lleva más de `RABBITMQ_DB_HOLD_MAX_MS` esperando, vuelve a la cola (nack con requeue) para no rebasar el `consumer_timeout` del broker. El watchdog no reconecta mientras MySQL está caído. Log: un `MySQL no disponible` al caer y un `MySQL disponible de nuevo tras X s` al volver. |
| Otro error transitorio de BD (deadlock, lock wait timeout) | Reintento (republica con la routing key original) hasta `RABBITMQ_MAX_RETRIES` |
| Error permanente (`BadRequestException`, JSON inválido, BD permanente, "incoherente"/"inválido") o reintentos agotados | DLQ con headers `x-death-reason`, `x-original-routing-key`, `x-retry-count` |

Catálogos Estado/Evento: [`contexto.md` §5](./contexto.md).

### 12.5 Health

#### `GET /health/rabbitmq`

Estado del consumidor (`connected`, `lastMessageAt`, `lastReconnectAt`, `reconnectAttempts`, contadores por label) + pool MySQL. 503 si está habilitado y desconectado; `degraded` si no hay mensajes en `CONSUMER_WATCHDOG_MINUTES`.

#### `GET /health/rabbitmq/queues`

Público (misma política que `/health/rabbitmq`). Solo observabilidad: consulta el broker con `checkQueue` en un canal temporal (timeout 5 s) sin tocar los consumidores. Los contadores viven en memoria y se reinician al reiniciar el servicio.

```json
{
  "status": "ok|degraded|down|disabled",
  "checkedAt": "2026-10-03T18:40:12.481Z",
  "connected": true,
  "uptimeSeconds": 86523,
  "queues": [
    {
      "queue": "telemetry.avl.events", "group": "avl", "label": "avl:events",
      "broker": { "messages": 4, "consumers": 1 },
      "processed": 98211, "failed": 0, "dlq": 0, "duplicate": 0,
      "lastMessageAt": "2026-10-03T18:40:11.977Z", "secondsSinceLastMessage": 0,
      "byProtocol": {
        "jt808": { "processed": 97540, "lastMessageAt": "…", "lastDeviceId": "013912345678" },
        "jimi":  { "processed": 671,   "lastMessageAt": "…", "lastDeviceId": "950204084" }
      },
      "state": "ok", "warnings": []
    },
    {
      "queue": "telemetry.avl.dlq", "group": "avl", "label": null,
      "broker": { "messages": 3, "consumers": 0 },
      "state": "degraded", "warnings": ["3 mensajes con error; revisar"]
    }
  ]
}
```

| Regla | Detalle |
|-------|---------|
| Cola de trabajo `down` | `consumers = 0` o la cola no existe (`broker: null`, `"cola no existe"`) |
| Cola de trabajo `degraded` | `messages > 100`, o fallos / DLQ dentro de `QUEUE_IDLE_WARN_SECONDS`, o el broker no respondió |
| Cola de trabajo `idle` | Sin mensajes en `QUEUE_IDLE_WARN_SECONDS` (solo `avl.events` y `axpro.heartbeats`) |
| DLQ | `degraded` si `messages > 0`; `ok` si vacía |
| `status` global | `disabled` (`RABBITMQ_ENABLED=false`) · `down` (sin conexión o alguna cola de trabajo `down`) · `degraded` (alguna `degraded`/`idle`) · `ok` |
| Aviso por protocolo | En `avl.events`: `"jimi sin mensajes desde hace N min"` sin cambiar el `state` |
| HTTP | 200 aunque el status sea `down`/`degraded`; 503 solo si falla la consulta |

`byProtocol` es `null` en las colas AX PRO. No expone credenciales, URL AMQP, eventIds ni payloads.

---

### 12.6 Equipos que transmiten sin alta (`TelemetryHuerfanos`)

Los sockets no filtran equipos (salvo TrackCam, que tiene registro propio): **NextAPI es la fuente de verdad del alta**. Cuando un mensaje no se puede asociar, el consumidor ya no lo descarta en silencio:

| Protocolo | Clave | Cuándo |
|---|---|---|
| `jt808` (TrackCam) | `NumeroSerie` | No existe en `Dispositivos` con estatus ACTIVO/ASIGNADO (`no_registrado`) o no tiene IMEI (`sin_imei`) |
| `jimi` (TrackGas) | IMEI | Igual, buscando por `Dispositivos.Imei` |
| `fa100s` (Reloj) | IMEI | Igual que `jimi`, buscando por `Dispositivos.Imei` |
| `axpro` (Panel) | Cuenta SIA | No hay `PanelAlarma` activo. El evento sigue guardándose en `EventoAlarma` con `Estatus=0`; el heartbeat se descarta |

- Upsert por `Protocol + DeviceId`: primera y última vez, número de mensajes, último routing key y última posición si la trae.
- El mensaje **se confirma** (no va a la DLQ). Un fallo al escribir la tabla solo se registra en log; no frena la cola.
- Log: `warn` solo la primera vez que aparece un equipo (`Equipo sin alta: …`); las repeticiones van en `debug`.
- Al darlo de alta, deja de registrarse (su `UltimaVez` se queda fija). `DELETE` lo quita de la lista; si sigue transmitiendo sin alta, vuelve a aparecer.

## 13. Alarmas (panel SIA / AX PRO)

Dominio distinto de alarmas GPS (`Posiciones.alarma1` / `idEvento`).

| Superficie | Contrato |
|------------|----------|
| REST consulta | `GET /alarmas/paneles`, `/paneles/:id`, `/ultimos-eventos`, `/eventos`, `/eventos/:id` (JWT + tenant) |
| Ingest | `POST /alarmas/ingest` (evento SIA), `/alarmas/ingest/heartbeat` (heartbeat RP) — HMAC `GATEWAY_HMAC_SECRET` |
| Socket `/alarmas` | Auth JWT; `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` |
| Persistencia | `EventoAlarma`, `UltimoEventoAlarma`, `PanelAlarma`, `GatewayIngestLog` |
| AX PRO AMQP | Misma familia de paneles vía `messaging/axpro` |

**Incidentes** (`/incidentes`): expediente abierto manualmente o **automáticamente** desde una `Posicion` o un `EventoAlarma` (snapshot `DatosOrigen`), con seguimientos.

**Incidentes automáticos** (`src/incidentes/auto/`): al ingerir una posición cuyo `Estado` entra en alerta de Consola (2, 3, 8, 9, 10, 11; antes no lo estaba), NextAPI abre un incidente con `Descripcion` "Alerta automática: <alerta>".
- Una alerta = IMEI + `Estado`, y además `IdEvento` si es de incidente propio (SOS, caída, ritmo cardiaco, colisión, volcadura, GNSS, sobrecupo): cada uno tiene su incidente aunque compartan estado.
- Si ya hay uno **abierto** de esa misma alerta no se abre otro: la alerta nueva se agrega como seguimiento (`Medio` = "Alerta automática", `IdUsuario` null, `FechaHora` = la de la posición) con el texto "Nueva alerta: <alerta> · ubicación <lat>, <lng> · posición <Id>".
- Un incidente solo se cierra con `PATCH /incidentes/:id/finalizar` (o `PATCH /incidentes/estatus/:id`); no hay cierre automático.
- Qué eventos abren incidente propio y el catálogo completo por equipo: [catalogo-eventos.md](./catalogo-eventos.md).

---

## 14. Dispositivos / Trackcam / Paneles / Relojes

| Ruta | Notas |
|------|--------|
| CRUD `/dispositivos` | `POST /`, `GET /list`, `GET /paginado/:page/:limit`, `GET /cliente/:idCliente`, `GET /:id`, `PATCH /estatus/:id`, `PATCH /:id`. Alta genérica; **rechaza** tipos TRACKCAM y RELOJ |
| `GET /dispositivos/:id` | Busca por ID **sin** validar el `idCliente` del token |
| CRUD `/dispositivos/trackcam` | 1:1 con `TrackcamConfig` + webhook saliente |
| CRUD `/dispositivos/paneles` | Panel alarma (SIA) |
| CRUD `/dispositivos/relojes` | Reloj FA100S: 1:1 con `RelojConfig` (§14.2). Sin webhook |

IMEI en API como **string**: `front-imei-string.md` (no está en el repositorio).

### 14.2 Relojes FA100S (`/dispositivos/relojes`)

Tipo `RELOJ INTELIGENTE` (`CatTipoDispositivo.Id = 7`, ya existe en producción) con su tabla 1:1 `RelojConfig`, igual que Trackcam. Marcas y modelos: `CatProductos` 6 'Reloj Inteligente'. DDL: `deploy/sql/Relojes.sql` (solo crea `RelojConfig`; incluye, comentado, cómo convertir un reloj dado de alta con otro tipo).

| Campo | Regla |
|---|---|
| `numeroSerie` | ID del reloj de **10 dígitos** (el que manda en `[3G*ID*…]`) o su IMEI de 15. Solo identifica |
| `imei` | **Obligatorio, 15 dígitos**: la telemetría (`fa100s.*`) se asocia por IMEI |
| `intervaloReporteSegundos` | `UPLOAD`, por defecto 300, mínimo 60 |
| `intervaloGpsSegundos` | Cada cuánto el servidor enciende el GPS (`CR`), por defecto 600; 0 = solo en SOS/caída. El reloj no enciende el GPS por su cuenta |
| `deteccionCaida` / `llamadaPorCaida` | `FALLDOWN,x,y` (0/1), por defecto 1/1 |
| `sensibilidadCaida` | `LSSET,n+6`: 1 a 6, **mayor = menos sensible**, por defecto 3 |

- Rutas iguales a Trackcam: `POST /`, `GET /list`, `GET /:page/:limit`, `GET /:id`, `PATCH /estatus/:id`, `PATCH /:id`.
- En la instalación, el reloj va en un producto de tipo **Persona** (`CatTipoProducto` 4), no en un vehículo.
- Ingesta: aplica geocerca; **no** aplica estados de tiempo detenido (son para vehículos).
- **Ubicación sin GPS:** `Posiciones` y `UltimaPosicion` traen `FuentePosicion` (0 GPS, 1 WiFi, 2 antena celular, 3 última válida; NULL = no informado, cámaras y AVL) y `RadioM` (radio en metros de la ubicación aproximada). Las calcula springGeoloc en spPenta0m con las redes WiFi y antenas que ve el reloj. Salen en el monitoreo, el historial y los reportes de posiciones como `fuentePosicion` / `radioM`. El front dibuja un círculo con `radioM` cuando `fuentePosicion` es 1 o 2. DDL: `deploy/sql/PosicionesFuente.sql`.
- **Pendiente:** que el socket aplique esta configuración al reloj. Hoy `springFA100S` usa valores globales de su `.env` (`FA100S_UPLOAD_INTERVAL_SEC`, `FA100S_GPS_WAKE_SEC`); la configuración por reloj queda guardada para cuando exista el canal Next → socket (springTrackCam `docs/cambios-back-next.md` §10.2).

### 14.1 Órdenes de servicio (`/ordenes-servicio`)

Evidencia de cada visita del técnico, ligada a Instalaciones. DDL y catálogo inicial: `deploy/sql/OrdenesServicio.sql`. Reglas puras: `src/ordenes-servicio/ordenes-servicio.reglas.ts`. Especificación completa (ejemplos, errores, despliegue): [ordenes-servicio.md](ordenes-servicio.md).

**Reglas de negocio**
- **El cliente se da de alta en oficina** antes de salir a campo; la orden no crea clientes (400 si no existe o no está activo).
- **El vehículo puede darse de alta en oficina o en campo.** La orden lo referencia por `idProducto`. En campo, la app lo busca con `GET /productos/vehiculos/placa/:placa` y, si no existe, lo crea con `POST /productos/vehiculos` (cualquier rol autenticado, incluido el técnico; rechaza placa repetida en el cliente). Ese `POST` devuelve `data.id` = `idProducto`, que se manda en el `POST`/`PATCH` de la orden. Debe estar disponible (estatus 1) para cerrar el alta.
- **Una orden = un tipo de servicio**: `instalacion` (alta), `revision`, `c_sim`, `c_equipo`, `desinstalacion`. El tipo no cambia después de crearla (en las programadas de la etapa 2 queda fijo al iniciar: `tipoProgramado` vs `tipoServicio`).
- **Guardado parcial**: la orden nace en `borrador`, se llena con `PATCH` y archivos, y se **cierra** al final. Folio `OS-000001` asignado por el servidor al crearla.
- **Idempotencia**: la app genera `claveApp` (UUID) al empezar; reenviar el `POST` devuelve la misma orden.
- **Técnico** = usuario del token (no se envía). Escriben roles 1, 2, 3 y 8; el técnico solo ve y edita sus órdenes. Leen además 4 y 5.
- **Monitorista** = `idMonitorista`, usuario activo con rol 4 o 5 (`GET /ordenes-servicio/catalogo` los lista).

**Flujo**

| Paso | Ruta | Notas |
|------|------|-------|
| Catálogo | `GET /ordenes-servicio/catalogo` | Opciones por sección y si la foto/firma es obligatoria; monitoristas. Las pantallas se arman con esto, no con listas fijas en la app |
| Iniciar | `POST /ordenes-servicio` | `{ claveApp, tipoServicio, idCliente, idInstalacion?, idProducto? }`. `idInstalacion` vigente obligatorio salvo en `instalacion`; en los demás tipos `idProducto` se toma de la instalación |
| Guardar | `PATCH /ordenes-servicio/:id` | Solo lo que cambia. `respuestas: [{ seccion, clave, valor }]` se agregan o reemplazan por (seccion, clave). `fechaCaptura` ISO 8601 con zona; `lat`/`lng` numéricos (null si no hay permiso). Campos que no aplican al tipo → 400 |
| Archivo | `POST /ordenes-servicio/:id/archivos/:clave` | multipart `file`, PNG o JPG (WEBP/HEIC se convierten a JPG en la app). Misma clave = reemplazo. S3 privado, carpeta `ordenes-servicio/` |
| Ver | `GET /ordenes-servicio/:id` | Respuestas, archivos con URL firmada (5 min) y, en borrador, `faltantesParaCerrar` |
| Cerrar | `POST /ordenes-servicio/:id/cerrar` | Valida y aplica el movimiento **en la misma transacción** (abajo). Incompleta → 400 `{ message, faltantes[] }`. Repetir el cierre devuelve el mismo resultado |
| Cancelar | `POST /ordenes-servicio/:id/cancelar` | Solo borrador; no toca la instalación |
| Listar | `GET /ordenes-servicio/paginado/:page/:limit` | Query: `idCliente`, `idProducto` (historial de la unidad), `idInstalacion` (atendida o resultante), `idTecnico`, `tipoServicio`, `estatus` |

**Qué se necesita para cerrar** (`faltantesParaCerrar`)
- Respuesta (sí o no) para **cada** opción activa de `vehiculo_cuenta_con`, `funcionamiento_vehiculo`, `fallas_equipo` y `pruebas`. Se guardan también las apagadas: así se distingue "no tiene / no pasó" de "no se revisó". No se exige marcar al menos una falla ni un accesorio.
- `fallas_equipo.otro = sí` → `observaciones` obligatorias.
- Al menos una prueba correcta, salvo en `desinstalacion`.
- Fotos y firmas con `Obligatorio = 1` en el catálogo: hoy `tablero_inicio`, `tablero_final`, `firma_cliente`, `firma_tecnico`.
- `idMonitorista`, y los datos del movimiento según el tipo.

**Movimiento al cerrar** (reutiliza `InstalacionesService` dentro de la transacción de la orden)

| Tipo | Datos | Instalaciones |
|------|-------|---------------|
| `instalacion` | `idProducto`, `idDispositivoNuevo`, `idSimNuevo?` | Alta (`create`); producto, equipo y SIM deben estar disponibles (1) |
| `c_equipo` | `idDispositivoNuevo`, `estatusSalienteAnterior` (0–5) | Nueva versión (`update`): la anterior se archiva con `EstatusInstalacion = 3` (baja por reemplazo) |
| `c_sim` | `idSimNuevo`, `estatusSalienteAnterior` (0–5) | Igual que `c_equipo` con la SIM |
| `desinstalacion` | `estatusInstalacionBaja` (0 inactiva / 5 inservible) | Baja (`baja`); componentes a disponible |
| `revision` | — | Sin cambio; solo se verifica que siga vigente |

La orden guarda `idInstalacion` (atendida), `idInstalacionResultado` (vigente después; el alta y los cambios crean Id nuevo) e `idHistoricoInstalacion` (versión archivada). El comentario del histórico lleva el folio y las observaciones. Si la instalación cambió por otra orden antes de cerrar → 400 "ya no está vigente".

**Tablas**: `OrdenesServicio`, `OrdenServicioRespuestas`, `OrdenServicioArchivos`, `CatOrdenServicioOpciones`. Sin FK a `Instalaciones` a propósito (el `PATCH` de instalaciones borra la fila anterior). Agregar una opción o una foto obligatoria = un `INSERT` en el catálogo, sin publicar otra versión de la app.

**Etapa 2** ([ordenes-servicio.md §12](ordenes-servicio.md)): la orden nace `programada` (CRM por `POST /integracion/ordenes-servicio` con firma HMAC `CRM_HMAC_SECRET`, u operación por `POST /ordenes-servicio/programar`); el técnico la inicia (`POST /:id/iniciar`) y confirma o corrige tipo y vehículo. Mantenimientos con código de verificación (`/:id/codigo`, `/:id/codigo/ver`, `/:id/codigo/validar`; pendientes en `GET /codigos-pendientes`). Alta sobre un vehículo con equipo: `/:id/autorizacion` y `/:id/autorizacion/decision`. Estados `programada → borrador → cerrada | no_cumplida | cancelada`, con motivos de `CatMotivosOrdenServicio` (`GET /motivos`) y `cobrable`. El CRM lee los cambios con `GET /integracion/ordenes-servicio/cambios?desde=`. DDL: `deploy/sql/OrdenesServicioEtapa2.sql`.

**Etapa 3** ([§13–§14](ordenes-servicio.md)): pruebas validadas por el operador (`/:id/pruebas/:clave/solicitar`, `/:id/pruebas/:clave/validar`, `GET /pruebas-pendientes`; el paro de motor se pide así), PDF (`GET /:id/pdf`), WhatsApp (`POST /:id/compartir`) y correo (`POST /:id/enviar-correo`). API de lectura y alta de clientes para el CRM en `/integracion/*` (clientes, técnicos, unidades, SIMs, órdenes realizadas). DDL: `deploy/sql/OrdenesServicioEtapa3.sql`.

**Remediación del 29/10/2026** ([ordenes-servicio.md §17](ordenes-servicio.md), [remediacion-ordenes-servicio.md](remediacion-ordenes-servicio.md)): firma del CRM v2 (`x-crm-firma: v2`, `x-crm-nonce`; HMAC de `${timestamp}.${nonce}.${MÉTODO} ${ruta}\n${cuerpo}`, cada nonce una vez en 5 min); cursor de `cambios` compuesto (`desde` + `despuesDe`) y `GET /integracion/ordenes-servicio/por-referencia/:referencia`; transiciones condicionales (409 si la orden cambió mientras tanto); autorización ligada al vehículo (`idProductoAutorizacion`); tope de 5 códigos por orden (`codigosEmitidos`) con `POST /:id/codigo/reiniciar` (roles 1–3); `notasInternas` fuera del PDF; cancelar una ya cancelada responde 200 con `data.claveMotivo`. DDL: `deploy/sql/OrdenesServicioEtapa4.sql`.

---

## 15. Webhooks salientes

NextAPI **emite**; no recibe webhooks de negocio de Shift/Trackcam.

| Destino | Config | Eventos |
|---------|--------|---------|
| Trackcam | `TRACKCAM_WEBHOOK_URL` + `WEBHOOK_SECRET` | `trackcam.created`, `trackcam.updated` |
| Genéricos (Shift, …) | `WEBHOOK_SUBSCRIBERS` (URLs coma) + `WEBHOOK_SECRET` | `vehiculo.created`, `vehiculo.updated`, `vehiculo.deleted`, `cliente.created`, `cliente.updated` |

Firma HMAC-SHA256 sobre objeto sin `signature` (orden: `event` → `timestamp` → `tenantId` → `entityId` → `data`). Fallo de entrega **no** revierte el CRUD local.

Guías: `webhook-trackcam-springtrackcam.md` (no está en el repositorio), [`webhook-shiftcontrol.md`](./webhook-shiftcontrol.md).

---

## 16. Variables de entorno (contrato)

Validadas con Joi en `app.module.ts`.

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `PORT` | No (3004) | Puerto |
| `DB_HOST`, `DB_USER`, `DB_DATABASE` | Sí | MySQL; `DB_DATABASE=Next` |
| `DB_PORT`, `DB_PASSWORD`, `DB_CONNECTION_LIMIT`, `DB_LOGGING` | No (3306 / '' / 10 / false) | MySQL; las consultas SQL solo se registran con `DB_LOGGING=true` |
| `LOG_LEVEL` | No (`log`) | `fatal\|error\|warn\|log\|debug\|verbose`; lo que se repite por mensaje de la cola va en `debug` |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Sí | Access / refresh |
| `THROTTLE_*_LIMIT` / `THROTTLE_*_TTL_MS` | Sí | Rate limit Auth (login, pin, verify, recuperación, confirmación, refresh, logout) |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `UPLOAD_MAX_SIZE` | Sí | S3 |
| `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD` | Sí | Nodemailer |
| `MAIL_FRONTEND_URL`, `MAIL_FRONTEND_URL_NEXT` | No | Base enlaces front |
| `GATEWAY_HMAC_SECRET` | Sí (mín. 16) | Ingest paneles |
| `CRM_HMAC_SECRET` | No (mín. 16 para activar) | Integración CRM (`/integracion/*`, firma v2 con nonce); vacío o menor de 16 = 503 |
| `CRM_ID_USUARIO` | No | Usuario de Next con el que el CRM queda en la bitácora; obligatorio para `POST /integracion/clientes` (sin él, 503) |
| `DB_TZ` | No | Zona horaria de la conexión MySQL (TypeORM) |
| `BEHAVIORIQ_BASE_URL`, `BEHAVIORIQ_USER_NAME`, `BEHAVIORIQ_PASSWORD`, `BEHAVIORIQ_LOGIN_TIMEOUT_MS`, `BEHAVIORIQ_VALIDATE_TIMEOUT_MS` | No (para el login facial) | BehaviorIQ |
| `THROTTLE_VALIDATE_FACE_LIMIT` / `THROTTLE_VALIDATE_FACE_TTL_MS` | No | Rate limit de `POST /auth/validateFace` |
| `GATEWAY_API_KEY`, `SIA_OFFLINE_THRESHOLD_MS` | No (— / 600000) | Ingest paneles / offline |
| `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET`, `TRACKCAM_WEBHOOK_URL`, `TRACKCAM_GATEWAY_URL` | No | Webhooks / proxy |
| `RABBITMQ_ENABLED` | No (false) | Activa consumers |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT` | No (127.0.0.1 / 5672 / backend / '' / / / 60) | Conexión |
| `RABBITMQ_EXCHANGE`, `RABBITMQ_DLX` | No (telemetry / telemetry.dlx) | Exchanges |
| `RABBITMQ_QUEUE_AXPRO_EVENTS`, `…_HEARTBEATS`, `…_DLQ` | No | Colas AX PRO |
| `RABBITMQ_QUEUE_AVL_EVENTS`, `…_ALARMS`, `…_DLQ` | No | Colas AVL |
| `RABBITMQ_PREFETCH`, `…_EVENTS`, `…_HEARTBEATS`, `…_AVL` | No (10 / 10 / 50 / 10) | Prefetch |
| `RABBITMQ_MAX_RETRIES`, `RABBITMQ_RECONNECT_MAX_DELAY`, `RABBITMQ_MAX_CONCURRENT_DB` | No (3 / 30000 / 5) | Reintentos / reconexión / concurrencia BD |
| `RABBITMQ_DB_RETRY_MAX_DELAY_MS`, `RABBITMQ_DB_HOLD_MAX_MS` | No (30000 / 300000) | Tope de espera entre intentos con MySQL caído / máximo que un mensaje espera antes de volver a la cola |
| `CONSUMER_WATCHDOG_MINUTES` | No (15) | Reconexión preventiva |
| `QUEUE_IDLE_WARN_SECONDS` | No (900) | Idle y ventana de fallos/DLQ en `/health/rabbitmq/queues` |
| `DEVICE_LOOKUP_CACHE_TTL_SEC` | No (600) | Cache de lookup de dispositivos |

No hay plantilla en el repositorio (`.env.example` está en `.gitignore`): usar la tabla de variables de esta sección.

---

## 17. Base de datos (resumen contractual)

| Aspecto | Spec |
|---------|------|
| Esquema | `Next` (MySQL 8) |
| Core | Clientes, Usuarios (refresh), Roles, Modulos, Permisos, UsuariosPermisos, AsignacionSoluciones, UsuariosInstalaciones, CodigoAutenticacion, Bitacora |
| Flota / GPS | Dispositivos, Sims, Instalaciones, HistoricoInstalaciones, Posiciones, UltimaPosicion (con `FuentePosicion`/`RadioM`, `deploy/sql/PosicionesFuente.sql`), Fotos, Videos |
| Órdenes de servicio | OrdenesServicio, OrdenServicioRespuestas, OrdenServicioArchivos, OrdenServicioPruebas, CatOrdenServicioOpciones, CatMotivosOrdenServicio (`deploy/sql/OrdenesServicio.sql` + `OrdenesServicioEtapa2.sql` + `Etapa3` + `Etapa4`, §14.1) |
| Dispositivos 1:1 | TrackcamConfig, RelojConfig (`deploy/sql/Relojes.sql`) |
| Operadores | Operadores, licencias |
| Alarmas | EventoAlarma, UltimoEventoAlarma, PanelAlarma, GatewayIngestLog |
| Ingest | TelemetryIngestLog, TelemetryHuerfanos (equipos sin alta, `deploy/sql/TelemetryHuerfanos.sql`) |
| Soft delete | `Estatus` 0/1 |
| Triggers posición | Completan NULL + espejo `UltimaPosicion` (NextAPI no upsert en app) |

---

## 18. Inventario / criterios de aceptación

### Telemetría y monitoreo
- [x] Listado GPS plano desde `UltimaPosicion` (vehículo/activo/persona)
- [x] Inmueble/panel sin UltimaPosicion
- [x] Socket `/monitoreo` con mismo shape que listado
- [x] Consola `GET /monitoreo/consola` + socket `conexion:consola` / `consola:actualizacion`
- [x] Instalaciones por usuarios (`POST /monitoreo/instalaciones-usuarios`)
- [x] Histórico + distancia Haversine + rutas media
- [x] Proxy foto/video Trackcam (`channelId` opcional)
- [x] Colas AVL compartidas (JT808 + Jimi) + AX PRO + idempotencia `eventId`
- [x] Retiro de colas legacy JT808/Jimi y de `telemetry.jt808.media`
- [x] `GET /health/rabbitmq/queues` con métricas por cola y por protocolo
- [x] Contrato de publicación de Server_Socket (`jimi.position`) validado
- [x] `Posiciones.IdFoto` legacy null en ingest; trigger para UltimaPosicion
- [x] Tiempo detenido 4/5/6; geocerca Estado=8

### Alarmas, incidentes, webhooks
- [x] Ingest HMAC + socket `/alarmas` + CRUD paneles
- [x] Incidentes (alta manual desde origen) + seguimientos
- [x] Webhooks Trackcam + genéricos HMAC

### Catálogo y plataforma
- [x] Auth JWT (login, refresh, logout, me, NIP, facial, recuperación Next/Shift, verify, throttle)
- [x] Clientes multipart (documentos opcionales en alta); Usuarios multipart; S3 upload/update
- [x] Catálogos (5 + registry); Sims; Dispositivos (`GET /:id` sin validación de cliente); Operadores + licencias
- [x] Permisos agrupados (`UsuariosPermisos` + `AsignacionSoluciones`)
- [x] Productos / instalaciones; geocercas; POI; números de emergencia; reportes; bitácora; mail; Swagger

### Fuera de estos contratos (explícito)
- Recalcular `Estado`/`Ignicion` en aplicación (lo hace el trigger)
- Generar “último estado” por prioridad Sion Tabla 3 en consulta
- Duplicar persistencia foto/video en el proxy HTTP
- Histórico GPS para inmuebles/paneles
- Regla R1 `maxDist = Vmax×Δt` en reportes NextAPI (documentada para Gateway: `posicion-valida-gateway.md` (no está en el repositorio); histórico suma todos los tramos por ahora)
- Borrado de colas legacy en el broker (tarea de infraestructura)
- Frontend Angular; ShiftControl / App Operador; Server_Socket; facturación; UX; pen-test (salvo addendum)

---

## 19. Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| [`contexto.md`](./contexto.md) | Visión, colas, sockets, alarmas, webhooks, cambios recientes y deuda técnica |
| `posicion-valida-gateway.md` (no está en el repositorio) | Análisis R1 para Gateway |
| Guías `consumo-*.md` | Consumo Angular |
| Guías `webhook-*.md` | Receptores / contratos webhook |
| `NEXTAPI-RABBITMQ-JT808.md` (no está en el repositorio), `CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md` (no está en el repositorio), `RABBITMQ-CONSUMER-FIX.md` (no está en el repositorio) | Detalle histórico de RabbitMQ (la fuente vigente de colas es §12) |

---

## 20. Aceptación

Este documento constituye el acuerdo técnico de contratos para NextAPI. Cambios de alcance o especificaciones requieren addendum por escrito aceptado por las partes.

---

*v3.2 (2026-10-30) — órdenes de servicio etapas 2–3 y remediación (integración CRM con firma v2), relojes FA100S (`RelojConfig`, `FuentePosicion`/`RadioM`), finalizar incidentes, equipos sin alta; guías [front-next.md](./front-next.md) y [app-instaladores.md](./app-instaladores.md).*

*v3.1 (2026-10-03) — colas AVL y retiro de legacy, health por cola, Server_Socket, consola en tiempo real, clientes con documentos opcionales, usuarios multipart, operadores con licencias, permisos agrupados, dispositivos sin validación de cliente en `GET /:id`, inventario completo de endpoints y variables. v3.0 — unificación de `contratos.md` (operativo) + `CONTRATO-PROYECTO-NEXTAPI.md` (alcance).*

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
| Mensajería | RabbitMQ AMQP — colas AVL (JT808 + Jimi) y AX PRO | Implementado |
| Observabilidad colas | `GET /health/rabbitmq` + `GET /health/rabbitmq/queues` | Implementado |
| Storage / Mail | AWS S3 / Nodemailer | Implementado |
| Docs API | Swagger `/docs` | Implementado |
| Pruebas | Jest + ts-jest (unitarias de messaging y utilidades) | Implementado |
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
- Roles de referencia: `1` SA, `2` Admin, `3` Monitorista, …, `6` Cliente, `7` Operador, `9` Usuario (ver guards vigentes)
- `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` (campos no declarados → 400)
- CORS `origin: '*'`, `credentials: true`
- Endpoints públicos (sin JWT): `POST /login` y flujos de recuperación, ingest HMAC de alarmas, `GET /health/rabbitmq`, `GET /health/rabbitmq/queues`

### 4.3 Soft delete y bitácora (Cat / recursos)

- `PATCH /estatus/:id` para activar/desactivar
- Bitácora en create / update / delete lógico
- Logs en servicio (y controlador si aplica) en operaciones críticas

---

## 5. Auth

Base: `/login` (+ `/auth` para facial) · Tag Swagger Autenticación.

| Endpoint | Uso / respuesta |
|----------|-----------------|
| `POST /login` | Body `{ userName, password }` → `{ token, refreshToken, expiresIn }` |
| `POST /login/operador/accesso/nip` | `{ accessToken, refreshToken, expiresIn }` |
| `POST /login/refresh` | Body `{ refreshToken }` → `{ token, accessToken, expiresIn }` |
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

Base: `/s3` · Roles `1, 2, 3`.

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
| Operadores | §10.2 |
| Productos | `GET /productos/list`, `GET /productos/paginado/:page/:limit`, `GET /productos/cliente/:idCliente`, `GET /productos/:id`, `PATCH /productos/estatus/:id`, `PATCH /productos/:id` (nombre) |
| Vehículos | `POST /productos/vehiculos`, `GET …/list`, `GET …/placa/:placa`, `GET …/:page/:limit`, `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Activos / Inmuebles / Personas | `POST /productos/{activos\|inmuebles\|personas}`, `GET …/list`, `GET …/:page/:limit`, `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Instalaciones | `POST /instalaciones`, `GET …/list`, `GET …/list/tipo/:idTipoProducto`, `GET …/cliente/:idCliente`, `GET …/historico/:id`, `POST …/paginado` (por tipo de producto), `GET …/:id` (detalle completo), `PATCH …/estatus/:id`, `PATCH …/:id` (archiva + nueva versión) |
| Monitoreo | §11 |
| Alarmas | §13 |
| Incidentes | `POST /incidentes`, `GET …/list` (abiertos), `GET …/cliente/:idCliente`, `GET /incidentes` (paginado), `GET …/:id/seguimientos`, `POST …/:id/seguimientos`, `GET …/:id`, `PATCH …/estatus/:id` (abierto ↔ cerrado), `PATCH …/:id` |
| Geocercas | `POST /geocercas`, `GET …/list`, `GET /geocercas` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id`, `DELETE …/:id` (físico) |
| Puntos de interés | `POST /puntos-interes`, `GET …/list`, `GET …/cliente/:idCliente`, `GET /puntos-interes` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Números de emergencia | `POST /numeros-emergencia`, `GET …/list`, `GET …/cliente/:idCliente`, `GET /numeros-emergencia` (paginado), `GET …/:id`, `PATCH …/estatus/:id`, `PATCH …/:id` |
| Reportes | `POST /reportes/paso-por-poi`, `POST /reportes/velocidad`, `POST /reportes/posiciones`, `POST /reportes/ultima-posicion`, `POST /reportes/distancia` (Haversine por IMEI) |
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

**Body opcional:** `{ "channelId": 1 }` (`1`–`5`; si falta → canales activos del registry).

Gateway: `terminalId` (NumeroSerie pad 12), `imei`, `saveFlag: 0`, `channelId?`.  
**No** INSERT local; media vía AMQP. Timeout proxy: **90 s**. Errores: 400 / 404 / 409 (cámara offline) / 504 (timeout).

### 11.7 `POST /monitoreo/:idInstalacion/video`

Proxy a `POST /gateway/video/capture`.

**Body opcional:** `{ "durationSeconds": 15, "channelId": 2 }` — default duration 30 (máx. 30).

Timeout: **90 s** (1 canal) / **150 s** (multi).

---

## 12. AMQP (AVL / AX PRO)

Exchange: `telemetry` (topic). DLX: `telemetry.dlx`. Prefijo código: `src/messaging/`.

| Grupo | Cola | Bindings | DLQ (routing key) |
|-------|------|----------|-------------------|
| AVL posiciones (JT808 + Jimi) | `telemetry.avl.events` | `jt808.position`, `jimi.position` | `telemetry.avl.dlq` (`telemetry.avl.failed`) |
| AVL alarmas (JT808 + Jimi) | `telemetry.avl.alarms` | `jt808.alarm.*`, `jimi.alarm.*` | `telemetry.avl.dlq` (`telemetry.avl.failed`) |
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
- `kind` debe coincidir con la cola (`position` → events, `alarm` → alarms); `protocol` ∉ {`jt808`, `jimi`} → DLQ.
- **Jimi:** lookup `payload.Imei || deviceId` → `Dispositivos.Imei` (estatus 1 o 2). Alarm AMQP solo SOS (`jimi.alarm.*`).
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

### 12.4 Reintentos y DLQ

| Caso | Resultado |
|------|-----------|
| Éxito o duplicado | ack |
| Dispositivo desconocido | warning en log + ack (no DLQ) |
| Error transitorio de BD | Reintento (republica con la routing key original) hasta `RABBITMQ_MAX_RETRIES` |
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

## 13. Alarmas (panel SIA / AX PRO)

Dominio distinto de alarmas GPS (`Posiciones.alarma1` / `idEvento`).

| Superficie | Contrato |
|------------|----------|
| REST consulta | `GET /alarmas/paneles`, `/paneles/:id`, `/ultimos-eventos`, `/eventos`, `/eventos/:id` (JWT + tenant) |
| Ingest | `POST /alarmas/ingest` (evento SIA), `/alarmas/ingest/heartbeat` (heartbeat RP) — HMAC `GATEWAY_HMAC_SECRET` |
| Socket `/alarmas` | Auth JWT; `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` |
| Persistencia | `EventoAlarma`, `UltimoEventoAlarma`, `PanelAlarma`, `GatewayIngestLog` |
| AX PRO AMQP | Misma familia de paneles vía `messaging/axpro` |

**Incidentes** (`/incidentes`): expediente abierto **manualmente** desde una `Posicion` o un `EventoAlarma` (snapshot `DatosOrigen`), con seguimientos.

---

## 14. Dispositivos / Trackcam / Paneles

| Ruta | Notas |
|------|--------|
| CRUD `/dispositivos` | `POST /`, `GET /list`, `GET /paginado/:page/:limit`, `GET /cliente/:idCliente`, `GET /:id`, `PATCH /estatus/:id`, `PATCH /:id`. Alta genérica; **rechaza** tipo TRACKCAM |
| `GET /dispositivos/:id` | Busca por ID **sin** validar el `idCliente` del token |
| CRUD `/dispositivos/trackcam` | 1:1 con `TrackcamConfig` + webhook saliente |
| CRUD `/dispositivos/paneles` | Panel alarma (SIA) |

IMEI en API como **string**: [`front-imei-string.md`](./front-imei-string.md).

---

## 15. Webhooks salientes

NextAPI **emite**; no recibe webhooks de negocio de Shift/Trackcam.

| Destino | Config | Eventos |
|---------|--------|---------|
| Trackcam | `TRACKCAM_WEBHOOK_URL` + `WEBHOOK_SECRET` | `trackcam.created`, `trackcam.updated` |
| Genéricos (Shift, …) | `WEBHOOK_SUBSCRIBERS` (URLs coma) + `WEBHOOK_SECRET` | `vehiculo.created`, `vehiculo.updated`, `vehiculo.deleted`, `cliente.created`, `cliente.updated` |

Firma HMAC-SHA256 sobre objeto sin `signature` (orden: `event` → `timestamp` → `tenantId` → `entityId` → `data`). Fallo de entrega **no** revierte el CRUD local.

Guías: [`webhook-trackcam-springtrackcam.md`](./webhook-trackcam-springtrackcam.md), [`webhook-shiftcontrol.md`](./webhook-shiftcontrol.md).

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
| `GATEWAY_API_KEY`, `SIA_OFFLINE_THRESHOLD_MS` | No (— / 600000) | Ingest paneles / offline |
| `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET`, `TRACKCAM_WEBHOOK_URL`, `TRACKCAM_GATEWAY_URL` | No | Webhooks / proxy |
| `RABBITMQ_ENABLED` | No (false) | Activa consumers |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT` | No (127.0.0.1 / 5672 / backend / '' / / / 60) | Conexión |
| `RABBITMQ_EXCHANGE`, `RABBITMQ_DLX` | No (telemetry / telemetry.dlx) | Exchanges |
| `RABBITMQ_QUEUE_AXPRO_EVENTS`, `…_HEARTBEATS`, `…_DLQ` | No | Colas AX PRO |
| `RABBITMQ_QUEUE_AVL_EVENTS`, `…_ALARMS`, `…_DLQ` | No | Colas AVL |
| `RABBITMQ_PREFETCH`, `…_EVENTS`, `…_HEARTBEATS`, `…_AVL` | No (10 / 10 / 50 / 10) | Prefetch |
| `RABBITMQ_MAX_RETRIES`, `RABBITMQ_RECONNECT_MAX_DELAY`, `RABBITMQ_MAX_CONCURRENT_DB` | No (3 / 30000 / 5) | Reintentos / reconexión / concurrencia BD |
| `CONSUMER_WATCHDOG_MINUTES` | No (15) | Reconexión preventiva |
| `QUEUE_IDLE_WARN_SECONDS` | No (900) | Idle y ventana de fallos/DLQ en `/health/rabbitmq/queues` |
| `DEVICE_LOOKUP_CACHE_TTL_SEC` | No (600) | Cache de lookup de dispositivos |

Plantilla: `.env.example`.

---

## 17. Base de datos (resumen contractual)

| Aspecto | Spec |
|---------|------|
| Esquema | `Next` (MySQL 8) |
| Core | Clientes, Usuarios (refresh), Roles, Modulos, Permisos, UsuariosPermisos, AsignacionSoluciones, UsuariosInstalaciones, CodigoAutenticacion, Bitacora |
| Flota / GPS | Dispositivos, Sims, Instalaciones, HistoricoInstalaciones, Posiciones, UltimaPosicion, Fotos, Videos |
| Operadores | Operadores, licencias |
| Alarmas | EventoAlarma, UltimoEventoAlarma, PanelAlarma, GatewayIngestLog |
| Ingest | TelemetryIngestLog |
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
- Regla R1 `maxDist = Vmax×Δt` en reportes NextAPI (documentada para Gateway: [`posicion-valida-gateway.md`](./posicion-valida-gateway.md); histórico suma todos los tramos por ahora)
- Borrado de colas legacy en el broker (tarea de infraestructura)
- Frontend Angular; ShiftControl / App Operador; Server_Socket; facturación; UX; pen-test (salvo addendum)

---

## 19. Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| [`contexto.md`](./contexto.md) | Visión, colas, sockets, alarmas, webhooks, cambios recientes y deuda técnica |
| [`posicion-valida-gateway.md`](./posicion-valida-gateway.md) | Análisis R1 para Gateway |
| Guías `consumo-*.md` | Consumo Angular |
| Guías `webhook-*.md` | Receptores / contratos webhook |
| [`NEXTAPI-RABBITMQ-JT808.md`](./NEXTAPI-RABBITMQ-JT808.md), [`CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md`](./CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md), [`RABBITMQ-CONSUMER-FIX.md`](./RABBITMQ-CONSUMER-FIX.md) | Detalle histórico de RabbitMQ (la fuente vigente de colas es §12) |

---

## 20. Aceptación

Este documento constituye el acuerdo técnico de contratos para NextAPI. Cambios de alcance o especificaciones requieren addendum por escrito aceptado por las partes.

---

*v3.1 (2026-10-03) — colas AVL y retiro de legacy, health por cola, Server_Socket, consola en tiempo real, clientes con documentos opcionales, usuarios multipart, operadores con licencias, permisos agrupados, dispositivos sin validación de cliente en `GET /:id`, inventario completo de endpoints y variables. v3.0 — unificación de `contratos.md` (operativo) + `CONTRATO-PROYECTO-NEXTAPI.md` (alcance).*

# Contexto — NextAPI

Documento **único** de contexto del backend NextAPI: visión, arquitectura, telemetría, colas AMQP, sockets, alarmas, webhooks y convenciones.

Contratos detallados (alcance + HTTP / Socket / AMQP): [`contratos.md`](./contratos.md).  
Swagger runtime: `/docs` (fuera del prefijo `/api`; ver `main.ts`).

Fecha de consolidación: 2026-10-03

---

## 1. Qué es Next / NextAPI

**Next** es la plataforma de monitoreo vehicular y gestión de flotas. Es el **Source of Truth** del ecosistema: clientes, usuarios, productos, dispositivos, instalaciones, posiciones y alarmas se crean y modifican aquí. Otros sistemas (ShiftControl, springTrackCam, App Operador, etc.) consumen vía REST, Socket.IO o webhooks; **no** escriben en la BD `Next`.

**NextAPI** es el backend NestJS 11 (TypeORM + MySQL) de esa plataforma.

### Stack

| Capa | Tecnología |
|------|------------|
| Backend | NestJS 11 + TypeScript |
| BD | MySQL 8 (`Next`) |
| ORM | TypeORM (`synchronize: false`) |
| Auth | JWT (Passport) + refresh |
| Tiempo real | Socket.IO (`/monitoreo`, `/alarmas`) |
| Mensajería | RabbitMQ (AMQP, amqplib) — colas AVL (JT808 + Jimi) y AX PRO |
| Storage | AWS S3 |
| Correo | Nodemailer |
| Docs API | Swagger (`/docs`) |
| Pruebas | Jest + ts-jest |

### Principios

| Principio | Aplicación |
|-----------|------------|
| Source of Truth | Solo NextAPI muta datos maestros |
| Multitenancy | `IdCliente` + `TenantFilterService` / alcance por rol |
| Clean layers | Controller → Service → Repository / Query |
| Event emitter | Webhooks salientes HMAC; Next no conoce al receptor |
| Observabilidad | `Logger` Nest + bitácora de negocio + health de RabbitMQ por cola; sin secretos en logs |

### Arranque (`main.ts`)

- Prefijo global `/api`; puerto `PORT` (default **3004**); `TZ` default `America/Mexico_City`.
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- CORS: `origin: '*'`, métodos `GET,HEAD,PUT,PATCH,POST,DELETE`, `credentials: true`. Los gateways Socket.IO declaran su propio CORS.
- Rate limit global (`ThrottlerGuard` como `APP_GUARD`): 100 peticiones / 60 s por clave de usuario; límites propios en Auth (`THROTTLE_*`).
- Servidores Swagger: `http://localhost:3004` y `https://springtelecom.mx/nextAPI`.

---

## 2. Roles del ecosistema

| Sistema | Rol |
|---------|-----|
| **NextAPI** | API de negocio, persistencia, listados, sockets, proxy foto/video, consumers AMQP, webhooks salientes |
| **springTrackCam** | Gateway JT808 (TCP cámara), captura HTTP foto/video, publica AMQP `jt808.*` |
| **springTrackGas** | Gateway Concox VL802, publica AMQP `jimi.*` |
| **Server_Socket** (.NET, SionDev) | Inserta la posición en SQL Server (SionDev) y después publica `jimi.position` al exchange `telemetry` (usuario AMQP `avl`) |
| **SpringPanel / SIA** | Ingest HMAC de paneles de alarma (`/alarmas/ingest`) |
| **AX PRO** | Eventos y heartbeats de panel vía colas `telemetry.axpro.*` |
| **ShiftControl / otros** | Suscriptores de webhooks salientes |
| **Frontend / BFF** | REST + sockets con JWT |

```text
Dashcam JT808 ──TCP──► springTrackCam ──AMQP jt808.*──┐
VL802 Concox  ──TCP──► springTrackGas ──AMQP jimi.* ──┤
Server_Socket ─────────────────────── AMQP jimi.position ┼──► NextAPI
AX PRO ──────────────────────────────── AMQP axpro.* ──┤
Panel SIA     ──HMAC─► /alarmas/ingest ───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         MySQL Next      Socket.IO      Webhooks HMAC
```

---

## 3. Colas AMQP (RabbitMQ)

Exchange: **`telemetry`** (topic, durable). Dead-letter exchange: **`telemetry.dlx`**. Prefijo de código: `src/messaging/`.

| Grupo | Cola | Bindings | DLQ (routing key) | Label métricas |
|-------|------|----------|-------------------|----------------|
| **AVL posiciones (JT808 + Jimi)** | `telemetry.avl.events` | `jt808.position`, `jimi.position` | `telemetry.avl.dlq` (`telemetry.avl.failed`) | `avl:events` |
| **AVL alarmas (JT808 + Jimi)** | `telemetry.avl.alarms` | `jt808.alarm.*`, `jimi.alarm.*` | `telemetry.avl.dlq` (`telemetry.avl.failed`) | `avl:alarms` |
| **AX PRO eventos** | `telemetry.axpro.events` | `axpro.event` | `telemetry.axpro.dlq` (`telemetry.axpro.failed`) | `axpro:event` |
| **AX PRO heartbeats** | `telemetry.axpro.heartbeats` | `axpro.heartbeat` | `telemetry.axpro.dlq` (`telemetry.axpro.failed`) | `axpro:heartbeat` |

Nombres configurables: `RABBITMQ_QUEUE_AVL_*`, `RABBITMQ_QUEUE_AXPRO_*`. Prefetch: `RABBITMQ_PREFETCH_AVL`, `RABBITMQ_PREFETCH_EVENTS`, `RABBITMQ_PREFETCH_HEARTBEATS` (fallback `RABBITMQ_PREFETCH`).

### Migración AVL (completada)

- **Deploy 1:** alta de `telemetry.avl.events` / `telemetry.avl.alarms` / `telemetry.avl.dlq`, `AvlEventsConsumer` y unbind de las colas legacy.
- **Deploy 2:** retiro en código de `telemetry.jt808.events`, `telemetry.jimi.events` y sus DLQ.
- Retirada también la cola de media `telemetry.jt808.media` (ya no hay consumer de `photo`).
- Pendiente de infraestructura: borrar en el broker (con `--if-empty`) `telemetry.jt808.events`, `telemetry.jimi.events`, `telemetry.jt808.dlq`, `telemetry.jimi.dlq` y `telemetry.jt808.media` si existen.

### Reglas de colas

- AVL: `AvlEventsConsumer` despacha por `protocol` (header o body) a `Jt808EventsConsumer` / `JimiEventsConsumer`; `kind` debe coincidir con la cola (`position` en events, `alarm` en alarms). Si no coincide → error permanente (DLQ sin reintentos).
- **Nunca** mezclar bindings `axpro.*` con las colas AVL.
- `kind=alarm` (JT808/Jimi) → auditoría en `TelemetryIngestLog`; **no** INSERT `Posiciones` (evita GPS duplicado). Jimi: solo SOS en `jimi.alarm.*`.
- Idempotencia global por `eventId` (SHA-256 hex 64) en `TelemetryIngestLog`.
- Reintentos: hasta `RABBITMQ_MAX_RETRIES` (republica con la routing key original). Errores permanentes (`BadRequestException`, JSON inválido, errores de BD permanentes, mensajes con "incoherente"/"inválido") van directo a la DLQ con headers `x-death-reason`, `x-original-routing-key`, `x-retry-count`.
- Concurrencia de BD limitada por `RABBITMQ_MAX_CONCURRENT_DB`.
- Watchdog: reconexión preventiva tras `CONSUMER_WATCHDOG_MINUTES` sin mensajes; reconexión con backoff hasta `RABBITMQ_RECONNECT_MAX_DELAY`.
- Dispositivo desconocido (IMEI / NumeroSerie no encontrado o con estatus distinto de 1/2) → warning en log y ack (no DLQ).

### Envelope común (JT808 / Jimi)

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

Headers AMQP esperados: `protocol`, `kind` y (opcional) `deviceId`. `message_id` = `eventId`.

| Protocolo | Lookup dispositivo |
|-----------|-------------------|
| JT808 | `deviceId` = `NumeroSerie` |
| Jimi | `payload.Imei \|\| deviceId` → `Dispositivos.Imei` (`resolveByImei`), estatus 1 (activo) o 2 (asignado) |

### Publicador Server_Socket (Jimi position)

- Publica a `telemetry` con routing key `jimi.position`, `content_type=application/json`, `delivery_mode=2`, `mandatory=true`, confirmaciones de publisher.
- Headers `protocol=jimi`, `kind=position`, `deviceId=<IMEI>`; `message_id = eventId`.
- Payload con la forma de la fila `Posiciones` (`Imei`, `Lat`, `Lng`, `Estado`, `FechaHora`, `Velocidad`, `Direccion`, `IdEvento`, …).
- Requisitos para que NextAPI lo acepte: `IdEvento` numérico, `Lat`/`Lng` numéricos, `FechaHora` en hora de pared de México (`YYYY-MM-DD HH:mm:ss`), IMEI registrado en `Dispositivos`.
- Validado contra el código (mensaje de ejemplo IMEI `950204084`): pasa por `AvlEventsConsumer` → `JimiEventsConsumer` sin errores.
- Recomendación: `eventId` determinista por posición (p. ej. SHA-256 de `Imei + FechaHora + IdEvento`) para que un reenvío se detecte como duplicado. `receivedAt` no se persiste para Jimi.

### Flujo position (orden en `PosicionIngestService`)

1. Idempotencia `eventId`.
2. Lookup dispositivo → IMEI (+ `idTipoDispositivo`, `idInstalacion` si aplica).
3. URLs `Foto1..3` → INSERT `Fotos` → FKs.
4. URLs `Video1..3` → INSERT `Videos` → FKs.
5. INSERT `Posiciones` (`Estado`/`Ignicion` del payload; **`IdFoto` legacy = null**).
   - Geocerca (estado 8) si aplica.
   - Tiempo detenido 4/5/6 si AVL/TRACKCAM/TRACKGAS y estado 0 + vel 0.
6. Trigger BD → completa NULL + espejo `UltimaPosicion`.
7. Socket `monitoreo:actualizacion` y `consola:actualizacion`.

### Health / observabilidad

| Endpoint | Uso |
|----------|-----|
| `GET /health/rabbitmq` | Estado del consumidor (conexión, último mensaje, reconexiones, contadores por label) + pool MySQL. 503 si está habilitado y desconectado. |
| `GET /health/rabbitmq/queues` | Estado **por cola**: datos del broker (`messages`, `consumers` vía `checkQueue` en canal temporal, timeout 5 s) + contadores en memoria (`processed`, `failed`, `dlq`, `duplicate`, `lastMessageAt`, desglose `byProtocol` jt808/jimi con `lastDeviceId`). Calcula `state` por cola y `status` global. |

Ambos son públicos (sin JWT; solo rate limit global). No exponen credenciales, URL AMQP, eventIds ni payloads. Los contadores se reinician al reiniciar el servicio (`uptimeSeconds`).

Reglas de `/health/rabbitmq/queues`:
- Cola de trabajo: `down` sin consumidores o inexistente; `degraded` con > 100 mensajes acumulados o fallos/DLQ dentro de `QUEUE_IDLE_WARN_SECONDS`; `idle` sin mensajes en `QUEUE_IDLE_WARN_SECONDS` (solo `avl.events` y `axpro.heartbeats`); `ok` en otro caso.
- DLQ: `degraded` si tiene mensajes (`"N mensajes con error; revisar"`); `ok` si está vacía.
- Global: `disabled` (`RABBITMQ_ENABLED=false`), `down`, `degraded`, `ok`. HTTP 200 salvo fallo de la consulta (503).
- Aviso extra en `avl.events` si un protocolo deja de reportar (`"jimi sin mensajes desde hace N min"`), sin cambiar el `state`.

Detalle de bindings y checklist: [`NEXTAPI-RABBITMQ-JT808.md`](./NEXTAPI-RABBITMQ-JT808.md), [`CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md`](./CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md), [`RABBITMQ-CONSUMER-FIX.md`](./RABBITMQ-CONSUMER-FIX.md) (algunos describen todavía las colas legacy; la fuente vigente es este documento).

---

## 4. Tablas de posición / media

| Tabla | Uso |
|-------|-----|
| `Posiciones` | Histórico por evento |
| `UltimaPosicion` | Última por IMEI (`UQ_UltimaPosicion_Imei`); listado, consola y socket |
| `Fotos` | `Ruta` pública; `IdFoto` = multimedia JT808 (**no** es FK de Posiciones) |
| `Videos` | `Ruta` pública MP4 |
| `TelemetryIngestLog` | Idempotencia AMQP |
| `GatewayIngestLog` | Idempotencia ingest HMAC alarmas |

NextAPI **no** hace upsert de `UltimaPosicion` en app: confía en trigger MySQL `AFTER INSERT`.

### Tipos de producto vs telemetría en monitoreo

| `IdTipoProducto` | Fuente en listado/socket |
|------------------|---------------------------|
| 1 Vehículo, 2 Activo, 4 Persona | `UltimaPosicion` (plano) |
| 3 Inmueble / panel | Lat/lng inmueble + `UltimoEventoAlarma` / heartbeat — **sin** UltimaPosicion |

Trackcam: `CatTipoDispositivo` código **TRACKCAM** (id típico 5). TRACKGAS = 6.

---

## 5. Estados, eventos y triggers (Sion)

Fuente: [`Documentacion Sion.pdf`](./Documentacion%20Sion.pdf). Catálogo extendido JT808: `src/common/cat-eventos.enum.ts`.

### Eventos base (`IdEvento`)

| Id | Nombre |
|----|--------|
| 1–2 | Ignición On / Off |
| 3–4 | Battery Low / Energy Alarm |
| 5 | Help me |
| 6–7 | Speed / Move |
| 8 | Door |
| 9–11 | Transmisión / Camera / Distance |
| ≥12 | ADAS / DSM / Sobrecupo (JT808) |

### Estados (`Estado`)

| Estado | Descripción |
|--------|-------------|
| 0 / 1 | Detenido / En movimiento |
| 2 / 3 | Alerta botón primario / secundario |
| 4 / 5 / 6 | Detenido >30 / >60 / >90 min |
| 7 | Exceso de velocidad |
| 8 | Fuera de geocerca |
| 9 / 10 / 11 | Batería baja / Falta energía / Movimiento |

### Prioridad Sion (Tabla 3)

Orden estricto: botón → energía → geocerca → exceso → batería → move → tiempo detenido → 0/1.  
Si aplica prioridad 1–6, **no** se evalúa detenido/circulando.

### En ingest NextAPI

| Regla | Cuándo |
|-------|--------|
| **Geocerca → 8** | Antes de tiempo detenido. Tipos 1/3/4/5/6. Geocerca con `IdInstalacion`. No pisa 2/3/10. |
| **Tiempo detenido 4/5/6** | Solo si llega `Estado=0` y `Velocidad=0` y tipo AVL/TRACKCAM/TRACKGAS. |
| **Triggers** | `trg_pos_before_ins` (Estado/Ignicion si NULL); `trg_pos_after_ins_ult` (UltimaPosicion). |

Código: `estado-geocerca.util.ts`, `estado-tiempo-detenido.util.ts`.

---

## 6. Socket.IO

Auth cliente: JWT en `auth.token` / `Authorization` / query.

### Namespace `/monitoreo`

| Evento | Dirección | Payload |
|--------|-----------|---------|
| `conexion:lista` | Server → cliente | `{ idsInstalaciones, posicion[] }` (mismo shape que `GET /monitoreo/list`) |
| `conexion:consola` | Server → cliente | `{ posicion[] }` (mismo shape que `GET /monitoreo/consola`) |
| `monitoreo:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano (listado) |
| `consola:actualizacion` | Server → room `instalacion:{id}` | Ítem plano `UltimaPosicion` (consola) |

Se emite tras ingest GPS (`notificarImei`) o cambios de dispositivo / instalación / panel relevantes (`notificarDispositivo`, `notificarInstalacion`). La consola es aditiva: no cambia el shape ni los nombres de `conexion:lista` / `monitoreo:actualizacion`.

Guías front: [`consumo-socket-monitoreo-angular.md`](./consumo-socket-monitoreo-angular.md), [`consumo-socket-posiciones-angular.md`](./consumo-socket-posiciones-angular.md).

### Namespace `/alarmas`

| Evento | Dirección | Uso |
|--------|-----------|-----|
| `conexion:lista` | Server → cliente | Paneles del alcance |
| `evento:nuevo` | Server → room `panel:{id}` | Nuevo `EventoAlarma` |
| `panel:heartbeat` | Server → room | Heartbeat |
| `panel:estado` | Server → room | Online/offline (`SIA_OFFLINE_THRESHOLD_MS`) |

Guías: [`consumo-socket-alarmas-angular.md`](./consumo-socket-alarmas-angular.md), [`consumo-socket-alarmas-paneles.md`](./consumo-socket-alarmas-paneles.md).

---

## 7. Alarmas de panel (SIA)

Dominio distinto de alarmas GPS (`Posiciones.alarma1` / `idEvento`).

| Superficie | Contrato |
|------------|----------|
| REST | `GET /alarmas/paneles`, `/paneles/:id`, `/ultimos-eventos`, `/eventos`, `/eventos/:id` (JWT + tenant) |
| Ingest | `POST /alarmas/ingest`, `/alarmas/ingest/heartbeat` — HMAC `GATEWAY_HMAC_SECRET` |
| Persistencia | `EventoAlarma`, `UltimoEventoAlarma`, `PanelAlarma`, `GatewayIngestLog` |
| Socket | `/alarmas` (arriba) |
| CRUD paneles | `/dispositivos/paneles` |

Cola AMQP AX PRO también alimenta el mismo dominio de paneles vía `messaging/axpro`.

Guías: [`consumo-alarmas-angular-produccion.md`](./consumo-alarmas-angular-produccion.md), [`consumo-login-alarmas.md`](./consumo-login-alarmas.md).

**Incidentes** (`/incidentes`): expediente de atención abierto manualmente desde una `Posicion` o un `EventoAlarma` (snapshot `DatosOrigen`), con seguimientos y estatus abierto ↔ cerrado. No es detección automática de alarmas.

---

## 8. Webhooks salientes

NextAPI **emite**; no recibe webhooks de negocio de Shift/Trackcam.

### Seguridad común

- `POST` JSON, HMAC-SHA256.
- Secreto: `WEBHOOK_SECRET`.
- Firma sobre objeto **sin** `signature`, orden de claves: `event` → `timestamp` → `tenantId` → `entityId` → `data`.
- Timeout típico emisor: ~5 s. Fallo de entrega **no** revierte el CRUD local.

### Eventos definidos

`vehiculo.created`, `vehiculo.updated`, `vehiculo.deleted`, `cliente.created`, `cliente.updated`, `trackcam.created`, `trackcam.updated` (`src/webhook-emitter/interfaces/webhook-event.interface.ts`).

### Trackcam

| Config | Variable |
|--------|----------|
| URL | `TRACKCAM_WEBHOOK_URL` |
| Eventos | `trackcam.created`, `trackcam.updated` |

Alta/edición en `/dispositivos/trackcam` → emite webhook.  
Guía receptor: [`webhook-trackcam-springtrackcam.md`](./webhook-trackcam-springtrackcam.md).

### ShiftControl / genéricos

| Config | Variable |
|--------|----------|
| Destinos | `WEBHOOK_SUBSCRIBERS` (URLs separadas por coma) |
| Eventos | `vehiculo.*`, `cliente.*` |

Si `WEBHOOK_SUBSCRIBERS` o `WEBHOOK_SECRET` vacíos → no envía.  
Contrato: [`webhook-shiftcontrol.md`](./webhook-shiftcontrol.md). Código: `src/webhook-emitter/`.

### Proxy HTTP Trackcam (no es webhook)

`POST /monitoreo/:idInstalacion/foto|video` → proxy a springTrackCam (`TRACKCAM_GATEWAY_URL`). **No** INSERT local; la media llega por AMQP.

---

## 9. Módulos de negocio

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth` | Login JWT, refresh, logout, `me`, NIP de operador, login facial (BehaviorIQ), recuperación / cambio de contraseña (Next y Shift), verify |
| `monitoreo` | Listado GPS, consola de `UltimaPosicion`, histórico, instalaciones por usuarios, socket GPS, proxy foto/video |
| `messaging` | Consumers RabbitMQ (AVL: JT808 + Jimi; AX PRO), métricas y health por cola |
| `alarmas` | Consulta + ingest HMAC + socket paneles |
| `incidentes` | CRUD incidentes + seguimientos (alta manual desde origen) |
| `dispositivos` / `trackcam` / `paneles` | CRUD dispositivos y configs (Trackcam solo por su ruta propia) |
| `sims` | CRUD SIM (plan, teléfono, IMEI, cliente, compañía) |
| `instalaciones` | Alta, versionado (archiva + nueva versión), histórico, paginado por tipo de producto |
| `productos` | Vehículo (incluye búsqueda por placa), activo, inmueble, persona + vista genérica de productos |
| `clientes` | CRUD multipart con documentos opcionales y jerarquía (`spGetClientes`) |
| `usuarios` | CRUD multipart, permisos y soluciones, asignación de instalaciones, IdFaceAuth, contraseña y NIP |
| `operadores` | CRUD multipart (1:1 Usuario) + licencias (alta, edición, estatus) |
| `roles` / `permisos` / `modulos` | Seguridad; `GET /permisos/permisosAgrupados` |
| `geocercas` / `puntos-interes` / `numeros-emergencia` | Operación de monitoreo |
| `reportes` | Paso por POI, velocidad, posiciones, última posición, distancia |
| `catalogos` | 5 catálogos CRUD + consulta unificada |
| `webhook-emitter` | Emisión HMAC |
| `bitacora`, `s3`, `mail` | Soporte |

Patrón NextAPI en catálogos/productos: módulo padre + submódulos + registry cuando aplica.

---

## 10. Multitenancy y auth (resumen)

- Roles globales (1–5, 8): sin filtro de cliente en listados.
- Rol 6: cliente + hijos (`spGetClientes`).
- Rol 7 / 9: su `idCliente` (u operadores / usuarios vía `UsuariosInstalaciones` en monitoreo).
- Excepción: `GET /dispositivos/:id` busca por ID sin validar el `idCliente` del token.
- Auth: `POST /login`, refresh, `GET /login/me`, NIP, face, recuperación — ver Swagger / [`contratos.md` §5](./contratos.md).

---

## 11. Variables de entorno relevantes

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto HTTP (default 3004) |
| `DB_*`, `DB_CONNECTION_LIMIT`, `DB_LOGGING`, `DB_TZ` | MySQL |
| `JWT_*` | Access / refresh |
| `THROTTLE_*` | Rate limit Auth |
| `RABBITMQ_*` | Broker, colas, prefetch, reintentos, reconexión |
| `CONSUMER_WATCHDOG_MINUTES` | Reconexión preventiva por inactividad |
| `QUEUE_IDLE_WARN_SECONDS` | Umbral idle y ventana de fallos/DLQ en `/health/rabbitmq/queues` (default 900) |
| `DEVICE_LOOKUP_CACHE_TTL_SEC` | Cache del lookup de dispositivos en ingest |
| `TRACKCAM_GATEWAY_URL` | Proxy foto/video |
| `TRACKCAM_WEBHOOK_URL` | Webhook Trackcam |
| `WEBHOOK_SUBSCRIBERS` | Destinos genéricos (Shift, …) |
| `WEBHOOK_SECRET` | HMAC webhooks |
| `GATEWAY_HMAC_SECRET`, `GATEWAY_API_KEY`, `SIA_OFFLINE_THRESHOLD_MS` | Ingest SIA / paneles |
| `AWS_*` / `UPLOAD_MAX_SIZE` | S3 |
| `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD`, `MAIL_FRONTEND_URL*` | Correo |

Plantilla: `.env.example`.

---

## 12. Convenciones de API

- Prefijo global: `/api`.
- Monitoreo list/consola/histórico: **sin** wrapper `data` (`{ posicion: [...] }`, `{ totalDistancia, posiciones }`).
- CRUD estándar: `{ data }` / `{ data, paginated }` / `ApiCrudResponse`.
- Campos **camelCase**; listado/socket de telemetría **plano** (sin JSON anidados de posición).
- `Posiciones.FechaHora` en histórico: hora de pared (sin forzar UTC en query).
- Ingest AMQP: `parseFechaHoraPared` (Date.UTC) para no sumar +6h con TZ México + `DB_TZ` UTC.
- IMEI como **string** en API (evitar pérdida de precisión): [`front-imei-string.md`](./front-imei-string.md).
- Multipart (`clientes`, `usuarios`, `operadores`, licencias): arreglos como JSON en texto; documentos como archivo o URL.

---

## 13. Distancia en histórico vs Gateway

- NextAPI histórico (`GET /monitoreo/:id/historico`) y reporte `POST /reportes/distancia` suman Haversine entre **todos** los puntos consecutivos (sin filtrar saltos, drift ni coordenadas).
- La validación de posiciones (p. ej. `maxDist = Vmax × Δt`) está documentada para el **Gateway** en [`posicion-valida-gateway.md`](./posicion-valida-gateway.md) y se implementará más adelante.

---

## 14. Cambios recientes (septiembre–octubre 2026)

| Área | Cambio |
|------|--------|
| Monitoreo | Socket de consola en tiempo real: `conexion:consola` y `consola:actualizacion` en `/monitoreo` (sin tocar `UltimaPosicion` ni los eventos existentes) |
| Clientes | `ComprobanteDomicilio`, `ConstanciaSituacionFiscal` y `ActaConstitutiva` opcionales en el alta |
| Messaging | Migración a colas AVL compartidas (deploy 1 y 2); retiro de `telemetry.jt808.media` y de las colas legacy JT808/Jimi |
| Messaging | `GET /health/rabbitmq/queues` + métricas por label y por protocolo (`recordProtocol`), variable `QUEUE_IDLE_WARN_SECONDS` |
| Messaging | Revisión del contrato de publicación de Server_Socket (`jimi.position`) |
| Permisos | `GET /permisos/permisosAgrupados` devuelve solo `{ UsuariosPermisos, AsignacionSoluciones }` (se quitaron `UsuarioPanelAlarma` y `UsuariosInstalaciones` de la respuesta) |
| Dispositivos | `GET /dispositivos/:id` sin validación de mismo cliente |
| Operadores | Licencias: `POST /operadores/:idOperador/licencias`, `PATCH /operadores/licencias/:id`, `PATCH /operadores/licencias/estatus/:id` |

### Deuda técnica conocida

- Jest no resuelve imports absolutos `src/...` (falta `moduleNameMapper`): falla `monitoreo-historico.helpers.spec.ts`.
- La query cruda de `permisosAgrupados` interpola `idUsuario` y fija el esquema `Next.`.
- `UsuarioPanelAlarma` sigue registrada en `usuarios.module.ts` sin uso; la tabla no existe en la BD.
- `kind: 'photo'` sigue en tipos/mappers JT808 aunque ya no hay cola de media.
- `Bitacora.Query` es `json` en la entidad y `varchar(1000)` en el DDL.
- CORS `origin: '*'` con `credentials: true` no es válido para peticiones con cookies.
- La descripción del tag Swagger de S3 menciona `DELETE /delete`, pero el controller no expone esa ruta.

---

## 15. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [`contratos.md`](./contratos.md) | Contratos únicos: alcance del proyecto + HTTP / Socket / AMQP / alarmas / webhooks |
| [`posicion-valida-gateway.md`](./posicion-valida-gateway.md) | Análisis R1 para Gateway (fuera de NextAPI) |
| [`NEXTAPI-RABBITMQ-JT808.md`](./NEXTAPI-RABBITMQ-JT808.md), [`CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md`](./CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md), [`RABBITMQ-CONSUMER-FIX.md`](./RABBITMQ-CONSUMER-FIX.md) | Detalle histórico de RabbitMQ |
| Guías `consumo-*.md` | Consumo Angular (sockets, alarmas, geocercas, instalaciones paginado, vehículo por placa, …) |
| Guías `webhook-*.md` | Receptores / contratos webhook |
| [`BACKEND-CONTEXT.md`](./BACKEND-CONTEXT.md), [`README.md`](./README.md) | Contexto previo e índice |

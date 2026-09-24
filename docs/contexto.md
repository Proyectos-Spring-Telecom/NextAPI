# Contexto — NextAPI

Documento **único** de contexto del backend NextAPI: visión, arquitectura, telemetría, colas AMQP, sockets, alarmas, webhooks y convenciones.

Contratos detallados (alcance + HTTP / Socket / AMQP): [`contratos.md`](./contratos.md).  
Swagger runtime: `/api/docs` (o la ruta en `main.ts`).

Fecha de consolidación: 2026-09-24

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
| Mensajería | RabbitMQ (AMQP) — JT808, Jimi, AX PRO |
| Storage | AWS S3 |
| Correo | Nodemailer |
| Docs API | Swagger |

### Principios

| Principio | Aplicación |
|-----------|------------|
| Source of Truth | Solo NextAPI muta datos maestros |
| Multitenancy | `IdCliente` + `TenantFilterService` / alcance por rol |
| Clean layers | Controller → Service → Repository / Query |
| Event emitter | Webhooks salientes HMAC; Next no conoce al receptor |
| Observabilidad | `Logger` Nest + bitácora de negocio; sin secretos en logs |

---

## 2. Roles del ecosistema

| Sistema | Rol |
|---------|-----|
| **NextAPI** | API de negocio, persistencia, listados, sockets, proxy foto/video, consumers AMQP, webhooks salientes |
| **springTrackCam** | Gateway JT808 (TCP cámara), captura HTTP foto/video, publica AMQP `jt808.*` |
| **springTrackGas** | Gateway Concox VL802, publica AMQP `jimi.*` |
| **SpringPanel / SIA** | Ingest HMAC de paneles de alarma (`/alarmas/ingest`) |
| **ShiftControl / otros** | Suscriptores de webhooks salientes |
| **Frontend / BFF** | REST + sockets con JWT |

```text
Dashcam JT808 ──TCP──► springTrackCam ──AMQP jt808.*──┐
VL802 Concox  ──TCP──► springTrackGas ──AMQP jimi.* ──┼──► NextAPI
Panel SIA     ──HMAC─► /alarmas/ingest ───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         MySQL Next      Socket.IO      Webhooks HMAC
```

---

## 3. Colas AMQP (RabbitMQ)

Exchange: **`telemetry`** (topic, durable). Prefijo de rutas: `src/messaging/`.

| Protocolo | Cola events | Bindings | DLQ / notas |
|-----------|-------------|----------|-------------|
| **JT808** | `telemetry.jt808.events` | `jt808.position`, `jt808.alarm.*` | `telemetry.jt808.dlq` |
| **JT808 media** | `telemetry.jt808.media` | `jt808.multimedia.photo` | misma DLQ |
| **Jimi (VL802)** | `telemetry.jimi.events` | `jimi.position`, `jimi.alarm.*` | `telemetry.jimi.dlq` |
| **AX PRO** | `telemetry.axpro.events` / `…heartbeats` | eventos / heartbeats de panel vía cola | `telemetry.axpro.dlq` |

Env relevantes: `RABBITMQ_*`, `RABBITMQ_QUEUE_JT808_*`, `RABBITMQ_QUEUE_JIMI_*`, `RABBITMQ_QUEUE_AXPRO_*`, prefetch por cola.

### Reglas de colas

- Colas **separadas** por protocolo: **nunca** mezclar bindings `jimi.*` en cola JT808 ni `axpro.*` en el mismo handler JT808.
- `kind=alarm` (JT808/Jimi) → auditoría en `TelemetryIngestLog`; **no** INSERT `Posiciones` (evita GPS duplicado). Jimi: solo SOS en `jimi.alarm.*`.
- Idempotencia global por `eventId` (SHA-256 hex 64) en `TelemetryIngestLog`.
- Health: `GET /health/rabbitmq`.

### Envelope común (JT808 / Jimi)

```json
{
  "eventId": "<sha256-hex-64>",
  "protocol": "jt808|jimi",
  "kind": "position|alarm|photo",
  "deviceId": "<NumeroSerie o IMEI Concox>",
  "receivedAt": "2026-09-03T23:30:00.000Z",
  "payload": { }
}
```

| Protocolo | Lookup dispositivo |
|-----------|-------------------|
| JT808 | `deviceId` = `NumeroSerie` |
| Jimi | `payload.Imei \|\| deviceId` → `Dispositivos.Imei` (`resolveByImei`) |

### Flujo position (orden en `PosicionIngestService`)

1. Idempotencia `eventId`.
2. Lookup dispositivo → IMEI (+ `idTipoDispositivo`, `idInstalacion` si aplica).
3. URLs `Foto1..3` → INSERT `Fotos` → FKs.
4. URLs `Video1..3` → INSERT `Videos` → FKs.
5. INSERT `Posiciones` (`Estado`/`Ignicion` del payload; **`IdFoto` legacy = null**).
   - Geocerca (estado 8) si aplica.
   - Tiempo detenido 4/5/6 si AVL/TRACKCAM/TRACKGAS y estado 0 + vel 0.
6. Trigger BD → completa NULL + espejo `UltimaPosicion`.
7. Socket `monitoreo:actualizacion`.

Detalle de bindings y checklist: [`NEXTAPI-RABBITMQ-JT808.md`](./NEXTAPI-RABBITMQ-JT808.md), [`CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md`](./CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md).

---

## 4. Tablas de posición / media

| Tabla | Uso |
|-------|-----|
| `Posiciones` | Histórico por evento |
| `UltimaPosicion` | Última por IMEI (`UQ_UltimaPosicion_Imei`); listado + socket |
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
| `monitoreo:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano |

Se emite tras ingest GPS (`notificarImei`) o cambios de panel relevantes al monitoreo.

Guías front: [`consumo-socket-monitoreo-angular.md`](./consumo-socket-monitoreo-angular.md), [`consumo-socket-posiciones-angular.md`](./consumo-socket-posiciones-angular.md).

### Namespace `/alarmas`

| Evento | Dirección | Uso |
|--------|-----------|-----|
| `conexion:lista` | Server → cliente | Paneles del alcance |
| `evento:nuevo` | Server → room `panel:{id}` | Nuevo `EventoAlarma` |
| `panel:heartbeat` | Server → room | Heartbeat |
| `panel:estado` | Server → room | Online/offline |

Guías: [`consumo-socket-alarmas-angular.md`](./consumo-socket-alarmas-angular.md), [`consumo-socket-alarmas-paneles.md`](./consumo-socket-alarmas-paneles.md).

---

## 7. Alarmas de panel (SIA)

Dominio distinto de alarmas GPS (`Posiciones.alarma1` / `idEvento`).

| Superficie | Contrato |
|------------|----------|
| REST | `GET /alarmas/paneles`, `/ultimos-eventos`, `/eventos`, … (JWT + tenant) |
| Ingest | `POST /alarmas/ingest`, `/alarmas/ingest/heartbeat` — HMAC `GATEWAY_HMAC_SECRET` |
| Persistencia | `EventoAlarma`, `UltimoEventoAlarma`, `PanelAlarma`, `GatewayIngestLog` |
| Socket | `/alarmas` (arriba) |
| CRUD paneles | `/dispositivos/paneles` |

Cola AMQP AX PRO también alimenta el mismo dominio de paneles vía `messaging/axpro`.

Guías: [`consumo-alarmas-angular-produccion.md`](./consumo-alarmas-angular-produccion.md), [`consumo-login-alarmas.md`](./consumo-login-alarmas.md).

**Incidentes** (`/incidentes`): expediente de atención abierto manualmente desde una `Posicion` o un `EventoAlarma` (snapshot `DatosOrigen`). No es detección automática de alarmas.

---

## 8. Webhooks salientes

NextAPI **emite**; no recibe webhooks de negocio de Shift/Trackcam.

### Seguridad común

- `POST` JSON, HMAC-SHA256.
- Secreto: `WEBHOOK_SECRET`.
- Firma sobre objeto **sin** `signature`, orden de claves: `event` → `timestamp` → `tenantId` → `entityId` → `data`.
- Timeout típico emisor: ~5 s. Fallo de entrega **no** revierte el CRUD local.

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
| Eventos | p. ej. `vehiculo.created`, cambios de cliente, … |

Si `WEBHOOK_SUBSCRIBERS` o `WEBHOOK_SECRET` vacíos → no envía.  
Contrato: [`webhook-shiftcontrol.md`](./webhook-shiftcontrol.md). Código: `src/webhook-emitter/`.

### Proxy HTTP Trackcam (no es webhook)

`POST /monitoreo/:idInstalacion/foto|video` → proxy a springTrackCam. **No** INSERT local; la media llega por AMQP.

---

## 9. Módulos de negocio

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth` | Login JWT, refresh, PIN, face, recuperación |
| `monitoreo` | Listado, histórico, socket GPS, proxy foto/video |
| `messaging` | Consumers RabbitMQ (JT808, Jimi, AX PRO) |
| `alarmas` | Consulta + ingest HMAC + socket paneles |
| `incidentes` | CRUD incidentes + seguimientos (alta manual desde origen) |
| `dispositivos` / `trackcam` / `paneles` | CRUD dispositivos y configs |
| `instalaciones` / `clientes` / `productos` | Catálogo operativo (vehículo, activo, inmueble, persona) |
| `webhook-emitter` | Emisión HMAC |
| `geocercas` / `puntos-interes` / `numeros-emergencia` | Operación de monitoreo |
| `reportes` | Reportes de posiciones / velocidad / POI |
| `catalogos`, `usuarios`, `roles`, `sims`, `bitacora`, `s3`, `mail` | Soporte |

Patrón NextAPI en catálogos/productos: módulo padre + submódulos + registry cuando aplica.

---

## 10. Multitenancy y auth (resumen)

- Roles globales (1–5, 8): sin filtro de cliente en listados.
- Rol 6: cliente + hijos (`spGetClientes`).
- Rol 7 / 9: su `idCliente` (u operadores vía asignaciones).
- Auth: `POST /login`, refresh, `GET /login/me`, PIN, face, recuperación — ver Swagger / [`contratos.md` §5](./contratos.md).

---

## 11. Variables de entorno relevantes

| Variable | Uso |
|----------|-----|
| `DB_*` | MySQL |
| `JWT_*` | Access / refresh |
| `RABBITMQ_*` | Broker y colas telemetría |
| `TRACKCAM_GATEWAY_URL` | Proxy foto/video |
| `TRACKCAM_WEBHOOK_URL` | Webhook Trackcam |
| `WEBHOOK_SUBSCRIBERS` | Destinos genéricos (Shift, …) |
| `WEBHOOK_SECRET` | HMAC webhooks |
| `GATEWAY_HMAC_SECRET` | Ingest SIA / paneles |
| `MONITOREO_SALTO_GPS_METROS` | Umbral salto en histórico (default 5 km) |
| `MONITOREO_DRIFT_DETENIDO_METROS` | Drift estacionado en histórico |
| `AWS_*` / `UPLOAD_MAX_SIZE` | S3 |
| `THROTTLE_*` | Rate limit auth |

Plantilla: `.env.example`.

---

## 12. Convenciones de API

- Prefijo global: `/api`.
- Monitoreo list/histórico: **sin** wrapper `data` (`{ posicion: [...] }`, `{ totalDistancia, posiciones }`).
- CRUD estándar: `{ data }` / `{ data, paginated }` / `ApiCrudResponse`.
- Campos **camelCase**; listado/socket de telemetría **plano** (sin JSON anidados de posición).
- `Posiciones.FechaHora` en histórico: hora de pared (sin forzar UTC en query).
- Ingest AMQP: `parseFechaHoraPared` (Date.UTC) para no sumar +6h con TZ México + `DB_TZ` UTC.
- IMEI como **string** en API (evitar pérdida de precisión): [`front-imei-string.md`](./front-imei-string.md).

---

## 13. Distancia en histórico vs Gateway

- NextAPI histórico usa tope fijo / drift (`MONITOREO_*`) al sumar `totalDistancia`.
- La regla de negocio recomendada para saltos GPS / offline (`maxDist = Vmax × Δt`, Vmax 250) está documentada para el **Gateway** en [`posicion-valida-gateway.md`](./posicion-valida-gateway.md). **No** se implementa como fuente de verdad en reportes NextAPI.

---

## 14. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [`contratos.md`](./contratos.md) | Contratos únicos: alcance del proyecto + HTTP / Socket / AMQP / alarmas / webhooks |
| [`posicion-valida-gateway.md`](./posicion-valida-gateway.md) | Análisis R1 para Gateway (fuera de NextAPI) |
| Guías `consumo-*.md` | Consumo Angular (sockets, alarmas, geocercas, …) |
| Guías `webhook-*.md` | Receptores / contratos webhook |
| `FLUJO-*.md` | Flujos puntuales (auth, S3, clientes, …) |

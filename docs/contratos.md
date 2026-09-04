# Contratos — NextAPI

Contratos HTTP, Socket.IO y AMQP de las funcionalidades implementadas. Complementa [`contexto.md`](./contexto.md).

Autenticación general (salvo ingest HMAC / health):  
`Authorization: Bearer <accessToken>`.

---

## 1. Monitoreo

Base: `/monitoreo` · Tag Swagger `Monitoreo`.

### 1.1 `GET /monitoreo/list`

Listado de instalaciones activas con telemetría según rol.

| Rol | Alcance |
|-----|---------|
| SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8) | Todas activas |
| Cliente (6) | Cliente + descendientes |
| Operador (7), Usuario (9) | `UsuariosInstalaciones` |

**Respuesta:** `{ "posicion": [ ... ] }` (plano, camelCase).

#### Shape GPS (tipos producto 1, 2, 4)

Contexto del producto + campos de `UltimaPosicion` (null si no hay fila):

| Campo | Origen |
|-------|--------|
| `idInstalacion`, `idCliente`, `idTipoProducto` | Instalación / producto |
| `cliente`, `placa` / `descripcion` / `persona`, `economico`, `marca`, `modelo`, … | Contexto por tipo |
| `imei`, `lat`, `lng`, `estado`, `fechaHora`, `velocidad`, `direccion`, `odometro`, `ignicion`, `alarma1`, `alarma2`, `energia`, `idEvento`, `idFoto`, `fhRegistro`, `bateria`, `alimentacion`, `gps`, `gsm`, `movimiento`, `combustible`, `nivelCombustible` | `UltimaPosicion` |
| `id` | `UltimaPosicion.Id` |

**No se exponen** en listado/socket: `idFoto1..3`, `idVideo1..3`, `rutaFoto*`, `rutaVideo*`.

#### Shape inmueble / panel (tipo 3)

Sin `UltimaPosicion`. Incluye `lat`/`lng` del inmueble, `ultimoHeartbeat`, `fechaHora`, `ultimoEventoAlarma`.

---

### 1.2 Socket.IO — namespace `/monitoreo`

| Evento | Dirección | Payload |
|--------|-----------|---------|
| Auth | Cliente → server | JWT en `auth.token` / `Authorization` / query |
| `conexion:lista` | Server → cliente | `{ idsInstalaciones: number[], posicion: MonitoreoPosicionItem[] }` (mismo shape que list) |
| `monitoreo:actualizacion` | Server → rooms `instalacion:{id}` | Un ítem plano (igual que un elemento de `posicion[]`) |

Se emite tras ingest JT808 (`notificarImei`) o cambios de panel relevantes.

---

### 1.3 `GET /monitoreo/:idInstalacion/historico`

Query: `fechaInicio`, `fechaFinal` (`YYYY-MM-DD HH:mm:ss`, hora de pared).

- **No aplica** a inmueble/panel (`400`).
- Lee `Posiciones` por IMEI; orden DESC.
- Calcula `totalDistancia` (Haversine) con exclusión de segmentos (salto GPS, drift, detenido).

**Respuesta:** `{ totalDistancia, posiciones: [...] }`.

Cada ítem conserva campos históricos existentes y añade en plano el resto de columnas de `Posiciones` + `rutaFoto` / `rutaFoto1..3` / `rutaVideo1..3` (null si faltan).

---

### 1.4 `POST /monitoreo/:idInstalacion/foto`

Proxy a springTrackCam `POST /gateway/photo/start`.

**Precondiciones:** instalación activa, dispositivo tipo TRACKCAM (codigo / id 5), `NumeroSerie` + `Imei` válidos.

**Headers:** reenvía el JWT del usuario.

**Body (opcional):**

```json
{ "channelId": 1 }
```

| Campo | Obligatorio | Notas |
|-------|-------------|--------|
| `channelId` | no | `1`–`5`; si falta → todos los canales activos del registry |

NextAPI envía al gateway: `terminalId` (NumeroSerie pad 12), `imei`, `saveFlag: 0`, y `channelId` solo si viene.

**Respuesta:** la del gateway (`Foto1..3`, `channelIds`, `location`, …).  
**No** INSERT local; persistencia vía AMQP.

Timeout proxy: **90 s**.

---

### 1.5 `POST /monitoreo/:idInstalacion/video`

Proxy a `POST /gateway/video/capture`.

**Body (opcional):**

```json
{ "durationSeconds": 15, "channelId": 2 }
```

| Campo | Default | Notas |
|-------|---------|--------|
| `durationSeconds` | 30 | Máx. 30 |
| `channelId` | — | `1`–`5`; si falta → paralelo multi-canal |

Gateway body: `terminalId`, `imei`, `durationSeconds`, `streamType: 0`, `dataType: 1`, `channelId?`.

Timeout: **90 s** (1 canal) / **150 s** (multi).

---

## 2. AMQP JT808 → NextAPI

| Parámetro | Valor |
|-----------|--------|
| Exchange | `telemetry` (topic) |
| Binding posiciones/media | `jt808.position` |
| Alarmas (opcional) | `jt808.alarm.*` |

### Envelope

```json
{
  "eventId": "<sha256-hex-64>",
  "protocol": "jt808",
  "kind": "position",
  "deviceId": "007773050481",
  "receivedAt": "2026-09-03T23:30:00.000Z",
  "payload": { }
}
```

### Persistencia (orden)

1. Idempotencia `eventId` (`TelemetryIngestLog`).
2. Lookup `deviceId` → Imei.
3. `Foto1..3` → INSERT `Fotos` → ids.
4. `Video1..3` → INSERT `Videos` → ids.
5. INSERT `Posiciones` (`Estado: null`, FKs media, **`IdFoto: null`**).
6. Trigger → `UltimaPosicion`.
7. Socket `monitoreo:actualizacion`.

`payload.IdFoto` / `jt808.multimediaId` → solo columna `Fotos.IdFoto` (no FK de Posiciones).

---

## 3. Trackcam — webhooks salientes

Eventos: `trackcam.created`, `trackcam.updated`.

| Config | Variable |
|--------|----------|
| URL | `TRACKCAM_WEBHOOK_URL` |
| Firma | `WEBHOOK_SECRET` (HMAC) |

Guía receptor SpringTrackCam: [`webhook-trackcam-springtrackcam.md`](./webhook-trackcam-springtrackcam.md) (si existe en el repo).

---

## 4. Alarmas (resumen contrato)

| Superficie | Contrato |
|------------|----------|
| REST consulta | `GET /alarmas/paneles`, `/ultimos-eventos`, `/eventos`, … |
| Ingest | `POST /alarmas/ingest`, `/ingest/heartbeat` (HMAC `GATEWAY_HMAC_SECRET`) |
| Socket `/alarmas` | `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` |

---

## 5. Auth (resumen)

| Endpoint | Uso |
|----------|-----|
| `POST /login` | Access + refresh |
| `POST /login/refresh` (o equivalente) | Renovar sesión |
| `GET /login/me` | Perfil |
| Flujos PIN / face / recuperación | Ver módulo `auth` + Swagger |

---

## 6. Dispositivos / Trackcam / Paneles

| Ruta | Notas |
|------|--------|
| `CRUD /dispositivos` | Alta genérica; **rechaza** tipo TRACKCAM |
| `CRUD /dispositivos/trackcam` | Alta 1:1 con `TrackcamConfig` + webhook |
| `CRUD /dispositivos/paneles` | Panel alarma (SIA) |

---

## 7. Health messaging

`GET /health/rabbitmq` — estado consumidor / pool.

---

## 8. Inventario de funcionalidades implementadas

### Telemetría y monitoreo
- [x] Listado GPS plano desde `UltimaPosicion` (vehículo/activo/persona)
- [x] Inmueble/panel sin UltimaPosicion
- [x] Socket `/monitoreo` con mismo shape que listado
- [x] Histórico `Posiciones` + distancia Haversine + rutas media
- [x] Proxy foto/video Trackcam (`channelId` opcional)
- [x] Consumer JT808: position (+ media URLs → Fotos/Videos → Posiciones)
- [x] Idempotencia `eventId`; Imei vía `NumeroSerie`
- [x] `Posiciones.IdFoto` legacy siempre null en ingest
- [x] Confianza en trigger MySQL para `UltimaPosicion` / `Estado`

### Alarmas y paneles
- [x] Ingest HMAC eventos/heartbeats
- [x] Consultas paginadas / filtros
- [x] Socket `/alarmas`
- [x] CRUD paneles bajo dispositivos

### Catálogo y operación
- [x] CRUD Trackcam + webhook HMAC
- [x] CRUD dispositivos / instalaciones / clientes / productos (vehículo, activo, persona, inmueble)
- [x] Catálogos (marcas, modelos, telefonía, combustible, registry genérico)
- [x] Auth JWT multi-paso (login, PIN, face, recuperación)
- [x] Usuarios, roles, permisos, módulos, operadores, SIMs, bitácora, S3, mail
- [x] Webhooks genéricos + Trackcam dedicados
- [x] Consumers AX PRO (eventos / heartbeats) en messaging

### Fuera de alcance de estos contratos
- Recalcular `Estado` en aplicación (lo hace el trigger)
- Duplicar persistencia foto/video en el proxy HTTP
- Histórico GPS para inmuebles/paneles

# Contexto — NextAPI

Backend NestJS 11 (TypeORM + MySQL) para telemetría GPS, alarmas, catálogo de dispositivos y operación de monitoreo. Consume AMQP (JT808 / AX PRO), expone REST + Socket.IO y emite webhooks firmados hacia gateways externos (SpringTrackCam, Shift, etc.).

---

## 1. Roles del sistema

| Sistema | Rol |
|---------|-----|
| **NextAPI** | API de negocio, persistencia, listados, sockets, proxy foto/video |
| **springTrackCam** | Gateway JT808 (TCP cámara), captura HTTP foto/video, publica AMQP |
| **SpringPanel / SIA** | Ingest HMAC de paneles de alarma |
| **Frontend / BFF** | Consume REST + sockets con JWT |

---

## 2. Arquitectura de telemetría GPS (Trackcam / JT808 / Jimi)

```text
Cámara JT808 ──TCP──► springTrackCam ──AMQP jt808.*──► NextAPI (cola telemetry.jt808.*)
VL802 Concox ──TCP──► springTrackGas ──AMQP jimi.* ──► NextAPI (cola telemetry.jimi.*)
                                                       ├─ DeviceLookup (NumeroSerie)
                                                       ├─ PosicionIngestService
                                                       └─ Posiciones + UltimaPosicion + WS
```

**Reglas clave**

- `deviceId` JT808 = `NumeroSerie` JT808; `deviceId` Jimi = IMEI Concox (= `NumeroSerie`).
- Colas **separadas** por protocolo (nunca mezclar bindings `jimi.*` en cola JT808).
- `kind=alarm` → solo `TelemetryIngestLog` (Jimi: solo SOS en `jimi.alarm.*`).
- IMEI se resuelve por lookup en `Dispositivos` (`payload.Imei` Jimi siempre null).
- `Estado` / `Ignicion` del payload se persisten; geocerca (8) y detenido (4/5/6) los calcula el ingest NextAPI.
- NextAPI **no** hace upsert de `UltimaPosicion` en aplicación (confía en el trigger MySQL AFTER INSERT).
- Captura HTTP on-demand Trackcam **no** persiste en NextAPI: el gateway publica AMQP y el consumer JT808 inserta.

---

## 3. Tablas centrales de posición / media

| Tabla | Uso |
|-------|-----|
| `Posiciones` | Histórico por evento (IMEI, coords, IdEvento, IdFoto1..3, IdVideo1..3, …) |
| `UltimaPosicion` | Última fila por IMEI (`UQ_UltimaPosicion_Imei`); listado + socket |
| `Fotos` | `Ruta` (URL pública), `IdFoto` = multimedia JT808 (no es PK de Posiciones) |
| `Videos` | `Ruta` (URL pública MP4) |
| `TelemetryIngestLog` | Idempotencia por `eventId` (SHA-256) |

### Mapeo media AMQP → BD

| AMQP | Acción |
|------|--------|
| `Foto1..3` (URL) | `INSERT Fotos` → `Posiciones.IdFoto1..3` |
| `Video1..3` (URL) | `INSERT Videos` → `Posiciones.IdVideo1..3` |
| `payload.IdFoto` | Solo `Fotos.IdFoto` (multimedia cámara); **nunca** FK `Posiciones.IdFoto` |
| `Posiciones.IdFoto` | Legacy → **NULL** |

---

## 4. Tipos de producto vs telemetría

| `IdTipoProducto` | Nombre | Fuente de posición en monitoreo |
|------------------|--------|----------------------------------|
| 1 | Vehículo | `UltimaPosicion` (plano) |
| 2 | Activo | `UltimaPosicion` (plano) |
| 3 | Inmueble / panel | Lat/lng del inmueble + `UltimoEventoAlarma` / heartbeat — **sin** UltimaPosicion |
| 4 | Persona | `UltimaPosicion` (plano) |

Tipo dispositivo Trackcam: `CatTipoDispositivo.Codigo = TRACKCAM` (id típico **5**).

---

## 5. Estados, eventos y triggers BD (Sion)

Fuente: [`Documentacion Sion.pdf`](./Documentacion%20Sion.pdf).

### 5.1 Catálogo de eventos (`IdEvento`, Tabla 1)

| Id | Nombre |
|----|--------|
| 1 | Ignicion On |
| 2 | Ignicion Off |
| 3 | Battery Low |
| 4 | Energy Alarm |
| 5 | Help me |
| 6 | Speed |
| 7 | Move |
| 8 | Door |
| 9 | Transmision |
| 10 | Camera |
| 11 | Distance |

Extensiones JT808 (ADAS/DSM/Sobrecupo, ids ≥12): ver `src/common/cat-eventos.enum.ts`.

### 5.2 Catálogo de estados (`Estado`, Tabla 2)

| Estado | Descripción | Color UI (Sion) |
|--------|-------------|-----------------|
| 0 | Autos detenidos | Gris |
| 1 | Autos en movimiento | Verde |
| 2 | Alerta botón primario | Rojo, parpadeando |
| 3 | Alerta botón secundario o accesorio | Amarillo, parpadeando |
| 4 | Detenido > 30 min | Amarillo |
| 5 | Detenido > 60 min | Naranja |
| 6 | Detenido > 90 min | Rojo |
| 7 | Exceso de velocidad (> umbral; configurable por vehículo) | Azul |
| 8 | Fuera de geocerca | — |
| 9 | Alerta batería baja | — |
| 10 | Alerta falta de energía | — |
| 11 | Alerta de movimiento | — |

### 5.3 Prioridad de generación de estados (Tabla 3 — Sion)

**Orden estricto** (gana el primero que aplique). Esta prioridad es la regla de negocio a respetar al generar `Estado` (en consulta **y**, cuando se implemente en app, en cada INSERT de posición):

| Prioridad | Condición | Estado resultante |
|-----------|-----------|-------------------|
| 1 | Alerta de botón (primario y/o secundario) | 2 y/o 3 |
| 2 | Falta de energía | 10 |
| 3 | Fuera de geocerca | 8 |
| 4 | Exceso de velocidad | 7 |
| 5 | Batería baja | 9 |
| 6 | Alerta de movimiento | 11 |
| 7 | Tiempo detenido (solo AVL / TRACKCAM) | 4 / 5 / 6 |
| 8 | Detenido / Circulando | 0 / 1 |

Si aplica una prioridad **1–6**, **no** se evalúa tiempo detenido ni detenido/circulando.

### 5.4 Generación base por evento (Tabla 10 — trigger / insumos)

Insumos típicos hacia la prioridad (§5.3), cuando `Estado` llega NULL o se recalcula desde telemetría:

| Estado candidato | Condición (`IdEvento` / `Velocidad`) |
|------------------|--------------------------------------|
| 0 | `IdEvento = 2` **o** (`IdEvento = 1` y `Velocidad = 0`) |
| 1 | `IdEvento = 1` y `Velocidad > 5` |
| 2 | `IdEvento = 5` (Help me) |
| 3 | `IdEvento = 8` (Door) |
| 9 | `IdEvento = 3` |
| 10 | `IdEvento = 4` |
| 11 | `IdEvento = 7` |

Estos candidatos se **colocan** en la cascada de prioridad; no se escriben a ciegas si hay algo de mayor prioridad.

### 5.5 Tiempo detenido (estados 4 / 5 / 6) — implementado en ingest

Solo si el insert trae **`Estado = 0` y `Velocidad = 0`** (cualquier otro estado se **conserva**: alertas prioritarias, geocerca 8, circulando, NULL) y el dispositivo es:

| Id | Código | Alcance |
|----|--------|---------|
| 3 | AVL | Sí |
| 5 | TRACKCAM | Sí |
| 6 | TRACKGAS | Sí |

Otros tipos: **no** aplicar 4/5/6.

En **cada INSERT** (`PosicionIngestService`), **después** de geocerca:

1. Gate: `debeAplicarTiempoDetenido` (tipo + estado 0 + vel 0).
2. Minutos = `FechaHora_actual −` última posición del IMEI con `Velocidad > 5` **o** `Estado = 1`.
3. Asignar: ≥90 → `6`, ≥60 → `5`, ≥30 → `4`, si no → `0`.
4. Código: `messaging/shared/estado-tiempo-detenido.util.ts`.

### 5.5b Fuera de geocerca (estado 8) — implementado en ingest

Prioridad **3** Sion. Se evalúa en cada INSERT **antes** del tiempo detenido.

| Id | Código | ¿Evalúa geocerca? |
|----|--------|-------------------|
| 1 | RASTREADOR | Sí |
| 2 | PANEL | **No** |
| 3 | AVL | Sí |
| 4 | TELEFONO | Sí |
| 5 | TRACKCAM | Sí |
| 6 | TRACKGAS | Sí |

Reglas:

1. Geocerca activa con **`IdInstalacion` = instalación del dispositivo**. Si `IdInstalacion` es **NULL** → **no aplica**.
2. Point-in-polygon (`Lat`/`Lng`) sobre `Geocercas.Geocerca` (GeoJSON Polygon / Feature).
3. Si está **fuera de al menos una** geocerca de esa instalación → `Estado = 8`.
4. **No pisa** estados 2, 3 ni 10 (botón / energía). **Sí pisa** exceso, batería, move, tiempo detenido, 0/1.
5. Lookup: `DeviceLookupService` resuelve `idInstalacion` (instalación activa del dispositivo). Código: `estado-geocerca.util.ts`.

### 5.6 Triggers MySQL

| Trigger | Momento | Función |
|---------|---------|---------|
| `trg_pos_before_ins` | BEFORE INSERT | Completa `Estado` / `Ignicion` si vienen NULL |
| `trg_pos_after_ins_ult` | AFTER INSERT | Espeja a `UltimaPosicion` por Imei |

`Ignicion` (Tabla 11): si NULL → 0 si IdEvento=2; 1 si IdEvento=1; si no, valor del registro previo del mismo IMEI.

`Estado=2` = pánico (no “en movimiento”).

---

## 6. Módulos de negocio (visión)

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth` | Login JWT, refresh, PIN, face, recuperación |
| `monitoreo` | Listado, histórico, socket GPS, proxy foto/video Trackcam |
| `messaging` | Consumers RabbitMQ JT808 + AX PRO |
| `alarmas` | Consulta + ingest HMAC + socket paneles |
| `dispositivos` / `trackcam` / `paneles` | CRUD dispositivos y configs |
| `instalaciones` / `clientes` / `productos` | Catálogo operativo |
| `webhook-emitter` | Emisión HMAC (Shift / Trackcam) |
| `catalogos`, `usuarios`, `roles`, `sims`, `bitacora`, `s3`, `mail` | Soporte |

Detalle de contratos HTTP/socket/AMQP: [`contratos.md`](./contratos.md).

---

## 7. Variables de entorno relevantes (telemetría / Trackcam)

| Variable | Uso |
|----------|-----|
| `TRACKCAM_GATEWAY_URL` | Base HTTP springTrackCam (foto/video) |
| `TRACKCAM_WEBHOOK_URL` | Webhook alta/edición Trackcam |
| `WEBHOOK_SECRET` | HMAC webhooks |
| `RABBITMQ_*` | Broker telemetría |
| `GATEWAY_HMAC_SECRET` | Ingest SIA / paneles |
| `MONITOREO_SALTO_GPS_METROS` | Umbral salto GPS en histórico |
| `MONITOREO_DRIFT_DETENIDO_METROS` | Drift estacionado en histórico |

Plantilla: `.env.example`.

---

## 8. Convenciones de API

- Respuestas de monitoreo list/histórico: **sin** wrapper `data` (`{ posicion: [...] }`, `{ totalDistancia, posiciones }`).
- Campos en **camelCase**; sin JSON anidados de telemetría en listado/socket (objeto plano).
- Fechas de `Posiciones.FechaHora` en histórico: hora de pared (sin forzar UTC en query params).

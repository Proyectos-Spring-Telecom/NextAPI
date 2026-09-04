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

## 2. Arquitectura de telemetría GPS (Trackcam / JT808)

```text
Cámara JT808 ──TCP──► springTrackCam ──AMQP jt808.position──► NextAPI
                              │                                    │
                              │ HTTP foto/video (on-demand)        ├─ INSERT Fotos/Videos (URLs)
                              │◄── proxy NextAPI /monitoreo/*/foto │─ INSERT Posiciones (FKs)
                              │    /video                          │─ Trigger BD → UltimaPosicion
                              │                                    └─ Socket /monitoreo
```

**Reglas clave**

- `deviceId` AMQP = `NumeroSerie` JT808 (12 dígitos), **no** es IMEI.
- IMEI se resuelve por lookup en `Dispositivos`.
- `Estado` en INSERT de `Posiciones` va **NULL**; el trigger BD lo deriva y espeja a `UltimaPosicion`.
- NextAPI **no** hace upsert de `UltimaPosicion` en aplicación (confía en el trigger MySQL).
- Captura HTTP on-demand **no** persiste en NextAPI: el gateway publica AMQP y el consumer JT808 inserta.

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

## 5. Triggers BD (MySQL)

Sobre `Posiciones` (entorno Next):

| Trigger | Momento | Función |
|---------|---------|---------|
| `trg_pos_before_ins` | BEFORE INSERT | Completa `Estado` / `Ignicion` si vienen NULL |
| `trg_pos_after_ins_ult` | AFTER INSERT | Espeja a `UltimaPosicion` por Imei |

No recalcular `Estado` en código salvo casos excepcionales. `Estado=2` = pánico (no “en movimiento”).

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

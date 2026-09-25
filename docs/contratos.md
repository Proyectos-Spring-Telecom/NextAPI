# Contratos — NextAPI

Documento **único** de contratos del backend NextAPI: alcance del proyecto, principios, especificaciones de API (Auth, S3, Clientes, Usuarios, Catálogos), y contratos operativos de **Monitoreo**, **AMQP**, **Sockets**, **Alarmas** y **Webhooks**.

Complementa [`contexto.md`](./contexto.md) (visión y flujos). Swagger: `/api/docs`.

**Versión:** 3.0 · **Fecha:** 2026-09-24

Autenticación general (salvo ingest HMAC / health):  
`Authorization: Bearer <accessToken|token>`.

---

## 1. Identificación y objeto

| Campo | Valor |
|-------|-------|
| **Nombre** | NextAPI |
| **Descripción** | Backend NestJS de la plataforma **Next** — Source of Truth de monitoreo vehicular y gestión de flotas |
| **BD** | MySQL 8 — esquema `Next` |

NextAPI es el único lugar donde se crean, modifican y dan de baja (soft delete) los datos maestros: clientes, usuarios, productos, instalaciones, dispositivos, posiciones, alarmas de panel e incidentes. Los consumidores (ShiftControl, springTrackCam, App Operador, front) usan REST, Socket.IO o webhooks HMAC; **no** escriben en la BD `Next`.

---

## 2. Stack tecnológico

| Capa | Tecnología | Estado |
|------|------------|--------|
| Backend | NestJS 11 + TypeScript | Implementado |
| BD / ORM | MySQL 8 + TypeORM (`synchronize: false`) | Implementado |
| Auth | JWT Passport + refresh (SHA256 en BD) | Implementado |
| Rate limiting | `@nestjs/throttler` (+ límites Auth `THROTTLE_*`) | Implementado |
| Tiempo real | Socket.IO (`/monitoreo`, `/alarmas`) | Implementado |
| Mensajería | RabbitMQ AMQP (JT808, Jimi, AX PRO) | Implementado |
| Storage / Mail | AWS S3 / Nodemailer | Implementado |
| Docs API | Swagger `/api/docs` | Implementado |
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
| Monitoreo list | `{ posicion: [...] }` (**sin** wrapper `data`) |
| Monitoreo histórico | `{ totalDistancia, posiciones: [...] }` |
| Errores | `{ statusCode, message, error }` |

Campos **camelCase**. Soft delete: `Estatus` 0/1; no DELETE físico en catálogos/recursos.

### 4.2 Seguridad

- Guards: `JwtAuthGuard`, `RolesGuard`, `@Roles()`
- Rate limit global + por usuario en Auth (`THROTTLE_*`)
- Login: fallo unificado `401` (sin enumeración de usuarios)
- Roles de referencia: `1` SA, `2` Admin, `3` Monitorista, … (ver guards vigentes)

### 4.3 Soft delete y bitácora (Cat / recursos)

- `PATCH /estatus/:id` para activar/desactivar
- Bitácora en create / update / delete lógico
- Logs en servicio (y controlador si aplica) en operaciones críticas

---

## 5. Auth

Base: `/login` · Tag Swagger Auth.

| Endpoint | Uso / respuesta |
|----------|-----------------|
| `POST /login` | `{ token, refreshToken, expiresIn }` |
| `POST /login/operador/accesso/nip` | `{ accessToken, refreshToken, expiresIn }` |
| `POST /login/refresh` | Body `{ refreshToken }` → `{ token, accessToken, expiresIn }` |
| `POST /login/logout` | JWT Bearer; revoca refresh |
| `GET /login/me` | Perfil + permisos |
| Recuperación / confirmación / verify | Respuesta genérica; código 6 dígitos; intentos limitados |
| PIN / face | Flujos del módulo `auth` (Swagger) |

Detalle hardening: `FLUJO-SEGURIDAD-AUTH.md`, `SEGURIDAD-LOGIN-NEXTAPI.md`.

---

## 6. S3

Base: `/s3` · Roles `1, 2, 3`.

| Método | Spec |
|--------|------|
| `POST /upload` | multipart: `file`, `folder`, `idModule` → `{ url }` |
| `PATCH /update` | multipart: `file`, `folder`, `idModule`, `oldUrl?` → `{ url }` |
| `DELETE /delete` | JSON: `fileUrl`, `idModule` → `{ deleted, key? }` |

**folder:** `clientes`, `operadores`, `usuarios`, `vehiculos`, `pasajeros`.  
**MIME genérico:** png/jpeg/jpg/pdf. Límite: `UPLOAD_MAX_SIZE`.  
`idUsuario` de bitácora solo desde JWT. Ref: `FLUJO-MEJORA-S3-UPDATE-DELETE.md`.

---

## 7. Clientes (multipart)

| Elemento | Spec |
|----------|------|
| `POST /`, `PATCH /:id` | `multipart/form-data` (no JSON como cuerpo principal) |
| Documentos en **alta** | Obligatorios: `actaConstitutiva`, `comprobanteDomicilio`, `constanciaSituacionFiscal` (PDF archivo y/o URL texto) |
| `logotipo` | Opcional PNG/JPEG |
| MIME por campo | En módulo Clientes, no en S3 genérico |
| Carpeta S3 | `clientes` |

Ref: `FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md`.

---

## 8. Usuarios (JSON)

| Elemento | Spec |
|----------|------|
| `POST /`, `PATCH /:id` | `application/json` |
| `fotoPerfil` | URL opcional (subir antes con `POST /s3/upload`, `folder=usuarios`, `idModule=2`) |
| Estatus | En DTO y/o `PATCH /usuarios/estatus/:id` |

La guía multipart de foto es **diseño**, no API vigente: `FLUJO-USUARIOS-FORM-DATA-FOTOPERFIL.md`.

---

## 9. Catálogos

- Patrón NextAPI: `src/catalogos/` padre + submódulos + registry.
- Unificado: `GET /catalogos/:nombreCatalogo` (ej. `cat-tipo-combustible`).
- CRUD por prefijo `/cat-*`:

| Ruta | Uso |
|------|-----|
| `GET /list` | Lista (`soloActivos` opcional) |
| `GET /:page/:limit` | Paginada |
| `GET /:id` | Por ID |
| `POST /` | Crear |
| `PATCH /:id` | Actualizar |
| `PATCH /estatus/:id` | Soft delete / reactivar |

---

## 10. Módulos de negocio (alcance implementado)

| Módulo | Rutas base / notas |
|--------|-------------------|
| Auth | `/login` (§5) |
| Clientes | `/clientes` multipart (§7) |
| Usuarios | `/usuarios` JSON (§8) |
| Roles / Permisos / Módulos | `/roles`, `/permisos`, `/modulos` |
| Bitácora | `/bitacora` |
| S3 / Mail | `/s3`; mail inyectable |
| Catálogos | `/cat-*`, `/catalogos/:nombre` (§9) |
| Sims / Dispositivos | `/sims`, `/dispositivos` (+ trackcam, paneles §14) |
| Operadores | `/operadores` (1:1 Usuario; 1ª licencia al crear) |
| Productos / Instalaciones | Vehículo, activo, inmueble, persona |
| Monitoreo | `/monitoreo` + socket (§11) |
| Messaging | Consumers AMQP (§12) |
| Alarmas | REST + ingest + socket (§13) |
| Incidentes | Alta manual desde Posición o EventoAlarma |
| Webhooks | Trackcam + genéricos (§15) |
| Geocercas / POI / Números emergencia / Reportes | Operación; `POST /reportes/distancia` (Haversine por IMEI) |

---

## 11. Monitoreo

Base: `/monitoreo` · Tag Swagger `Monitoreo`.

### 11.1 `GET /monitoreo/list`

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
| `idTipoDispositivo`, `codigoTipoDispositivo`, `nombreTipoDispositivo` | `CatTipoDispositivo` |
| `cliente`, `placa` / `descripcion` / `persona`, `economico`, `marca`, `modelo`, … | Contexto por tipo |
| `imei`, `lat`, `lng`, `estado`, `fechaHora`, `velocidad`, `direccion`, `odometro`, `ignicion`, `alarma1`, `alarma2`, `energia`, `idEvento`, `idFoto`, `fhRegistro`, `bateria`, `alimentacion`, `gps`, `gsm`, `movimiento`, `combustible`, `nivelCombustible` | `UltimaPosicion` |
| `id` | `UltimaPosicion.Id` |

**No se exponen** en listado/socket: `idFoto1..3`, `idVideo1..3`, `rutaFoto*`, `rutaVideo*`.

#### Shape inmueble / panel (tipo 3)

Sin `UltimaPosicion`. Incluye `lat`/`lng` del inmueble, `ultimoHeartbeat`, `fechaHora`, `ultimoEventoAlarma`.

### 11.2 Socket.IO — `/monitoreo`

| Evento | Dirección | Payload |
|--------|-----------|---------|
| Auth | Cliente → server | JWT en `auth.token` / `Authorization` / query |
| `conexion:lista` | Server → cliente | `{ idsInstalaciones, posicion[] }` (mismo shape que list) |
| `conexion:consola` | Server → cliente | `{ posicion[] }` (mismo shape que `GET /monitoreo/consola`) |
| `monitoreo:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano (listado) |
| `consola:actualizacion` | Server → room `instalacion:{id}` | Un ítem plano de `UltimaPosicion` (consola) |

Se emite tras ingest GPS (`notificarImei`) o cambios de panel relevantes.

### 11.3 `GET /monitoreo/:idInstalacion/historico`

Query: `fechaInicio`, `fechaFinal` (`YYYY-MM-DD HH:mm:ss`, hora de pared).

- **No aplica** a inmueble/panel (`400`).
- Lee `Posiciones` por IMEI; orden DESC.
- `totalDistancia` Haversine entre **todos** los puntos consecutivos (sin filtrar saltos, drift ni coordenadas).

**Respuesta:** `{ totalDistancia, posiciones: [...] }` — ítems con columnas de `Posiciones` + `rutaFoto` / `rutaFoto1..3` / `rutaVideo1..3`.

### 11.4 `POST /monitoreo/:idInstalacion/foto`

Proxy a springTrackCam `POST /gateway/photo/start`.

**Precondiciones:** instalación activa, dispositivo TRACKCAM (código / id 5), `NumeroSerie` + `Imei` válidos. Reenvía JWT.

**Body opcional:** `{ "channelId": 1 }` (`1`–`5`; si falta → canales activos del registry).

Gateway: `terminalId` (NumeroSerie pad 12), `imei`, `saveFlag: 0`, `channelId?`.  
**No** INSERT local; media vía AMQP. Timeout proxy: **90 s**.

### 11.5 `POST /monitoreo/:idInstalacion/video`

Proxy a `POST /gateway/video/capture`.

**Body opcional:** `{ "durationSeconds": 15, "channelId": 2 }` — default duration 30 (máx. 30).

Timeout: **90 s** (1 canal) / **150 s** (multi).

---

## 12. AMQP (JT808 / Jimi / AX PRO)

Exchange: `telemetry` (topic). Prefijo código: `src/messaging/`.

| Protocolo | Cola events | Bindings | DLQ |
|-----------|-------------|----------|-----|
| JT808 | `telemetry.jt808.events` | `jt808.position`, `jt808.alarm.*` | `telemetry.jt808.dlq` |
| JT808 media | `telemetry.jt808.media` | `jt808.multimedia.photo` | idem |
| Jimi (VL802) | `telemetry.jimi.events` | `jimi.position`, `jimi.alarm.*` | `telemetry.jimi.dlq` |
| AX PRO | `telemetry.axpro.events` / `…heartbeats` | eventos / heartbeats panel | `telemetry.axpro.dlq` |

### Envelope JT808 / Jimi

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

**Jimi:** lookup `payload.Imei || deviceId` → `Dispositivos.Imei`. Alarm AMQP solo SOS (`jimi.alarm.*`).

### Persistencia position (orden)

1. Idempotencia `eventId` (`TelemetryIngestLog`).
2. Lookup dispositivo → Imei.
3. `Foto1..3` → INSERT `Fotos` → ids.
4. `Video1..3` → INSERT `Videos` → ids.
5. INSERT `Posiciones` (Estado/Ignicion del payload; FKs media; **`IdFoto: null`**).
   - Geocerca → `Estado=8` (tipos 1/3/4/5/6; no pisa 2/3/10).
   - AVL/TRACKCAM/TRACKGAS + `Estado=0` + `Velocidad=0` → puede subir a 4/5/6.
6. Trigger BD → NULL + espejo `UltimaPosicion`.
7. Socket `monitoreo:actualizacion`.

`payload.IdFoto` / `jt808.multimediaId` → solo `Fotos.IdFoto` (no FK de Posiciones).

Catálogos Estado/Evento: [`contexto.md` §5](./contexto.md). Detalle colas: `NEXTAPI-RABBITMQ-JT808.md`.

### Health

`GET /health/rabbitmq` — estado consumidor / pool.

---

## 13. Alarmas (panel SIA / AX PRO)

Dominio distinto de alarmas GPS (`Posiciones.alarma1` / `idEvento`).

| Superficie | Contrato |
|------------|----------|
| REST consulta | `GET /alarmas/paneles`, `/ultimos-eventos`, `/eventos`, … (JWT + tenant) |
| Ingest | `POST /alarmas/ingest`, `/alarmas/ingest/heartbeat` — HMAC `GATEWAY_HMAC_SECRET` |
| Socket `/alarmas` | Auth JWT; `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` |
| Persistencia | `EventoAlarma`, `UltimoEventoAlarma`, `PanelAlarma`, `GatewayIngestLog` |
| AX PRO AMQP | Misma familia de paneles vía `messaging/axpro` |

**Incidentes** (`/incidentes`): expediente abierto **manualmente** desde una `Posicion` o un `EventoAlarma` (snapshot `DatosOrigen`).

---

## 14. Dispositivos / Trackcam / Paneles

| Ruta | Notas |
|------|--------|
| CRUD `/dispositivos` | Alta genérica; **rechaza** tipo TRACKCAM |
| CRUD `/dispositivos/trackcam` | 1:1 con `TrackcamConfig` + webhook saliente |
| CRUD `/dispositivos/paneles` | Panel alarma (SIA) |

IMEI en API como **string**: [`front-imei-string.md`](./front-imei-string.md).

---

## 15. Webhooks salientes

NextAPI **emite**; no recibe webhooks de negocio de Shift/Trackcam.

| Destino | Config | Eventos |
|---------|--------|---------|
| Trackcam | `TRACKCAM_WEBHOOK_URL` + `WEBHOOK_SECRET` | `trackcam.created`, `trackcam.updated` |
| Genéricos (Shift, …) | `WEBHOOK_SUBSCRIBERS` (URLs coma) + `WEBHOOK_SECRET` | p. ej. `vehiculo.created`, cambios de cliente |

Firma HMAC-SHA256 sobre objeto sin `signature` (orden: `event` → `timestamp` → `tenantId` → `entityId` → `data`). Fallo de entrega **no** revierte el CRUD local.

Guías: [`webhook-trackcam-springtrackcam.md`](./webhook-trackcam-springtrackcam.md), [`webhook-shiftcontrol.md`](./webhook-shiftcontrol.md).

---

## 16. Variables de entorno (contrato)

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `PORT` | No (3010) | Puerto |
| `DB_*` | Sí | MySQL; `DB_DATABASE=Next` |
| `JWT_*`, `JWT_REFRESH_*` | Sí | Access / refresh |
| `JWT_CONFIRMACION` | No (`15m`) | Enlaces de correo |
| `THROTTLE_*` | No | Rate limit Auth |
| `AWS_*`, `UPLOAD_MAX_SIZE` | Sí | S3 |
| `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD` | Sí | Nodemailer |
| `MAIL_FRONTEND_URL` | No | Base enlaces front |
| `RABBITMQ_*` | Sí (telemetría) | Broker y colas |
| `TRACKCAM_GATEWAY_URL` | Sí (proxy) | Foto/video |
| `TRACKCAM_WEBHOOK_URL` | No | Webhook Trackcam |
| `WEBHOOK_SUBSCRIBERS` | No | Destinos genéricos |
| `WEBHOOK_SECRET` | Condicional | HMAC webhooks |
| `GATEWAY_HMAC_SECRET` | Condicional | Ingest paneles |

Plantilla: `.env.example`.

---

## 17. Base de datos (resumen contractual)

| Aspecto | Spec |
|---------|------|
| Esquema | `Next` (MySQL 8) |
| Core | Clientes, Usuarios (refresh), Roles, Modulos, Permisos, CodigoAutenticacion, Bitacora |
| Flota / GPS | Dispositivos, Sims, Instalaciones, HistoricoInstalaciones, Posiciones, UltimaPosicion, Fotos, Videos |
| Alarmas | EventoAlarma, UltimoEventoAlarma, PanelAlarma, GatewayIngestLog |
| Ingest | TelemetryIngestLog |
| Soft delete | `Estatus` 0/1 |
| Triggers posición | Completan NULL + espejo `UltimaPosicion` (NextAPI no upsert en app) |

Análisis amplio: `ANALISIS-BD-NEXT.md` (si existe en el repo).

---

## 18. Inventario / criterios de aceptación

### Telemetría y monitoreo
- [x] Listado GPS plano desde `UltimaPosicion` (vehículo/activo/persona)
- [x] Inmueble/panel sin UltimaPosicion
- [x] Socket `/monitoreo` con mismo shape que listado
- [x] Histórico + distancia Haversine + rutas media
- [x] Proxy foto/video Trackcam (`channelId` opcional)
- [x] Consumers JT808 / Jimi / AX PRO + idempotencia `eventId`
- [x] `Posiciones.IdFoto` legacy null en ingest; trigger para UltimaPosicion
- [x] Tiempo detenido 4/5/6; geocerca Estado=8

### Alarmas, incidentes, webhooks
- [x] Ingest HMAC + socket `/alarmas` + CRUD paneles
- [x] Incidentes (alta manual desde origen)
- [x] Webhooks Trackcam + genéricos HMAC

### Catálogo y plataforma
- [x] Auth JWT (login, refresh, logout, me, PIN, recuperación, verify, throttle)
- [x] Clientes multipart; Usuarios JSON; S3 upload/update/delete
- [x] Catálogos (20 + registry); Sims; Dispositivos; Operadores
- [x] Productos / instalaciones; bitácora; mail; Swagger

### Fuera de estos contratos (explícito)
- Recalcular `Estado`/`Ignicion` en aplicación (lo hace el trigger)
- Generar “último estado” por prioridad Sion Tabla 3 en consulta
- Duplicar persistencia foto/video en el proxy HTTP
- Histórico GPS para inmuebles/paneles
- Regla R1 `maxDist = Vmax×Δt` en reportes NextAPI (documentada para Gateway: [`posicion-valida-gateway.md`](./posicion-valida-gateway.md); histórico suma todos los tramos por ahora)
- Frontend Angular; ShiftControl / App Operador; facturación; UX; pen-test (salvo addendum)

---

## 19. Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| [`contexto.md`](./contexto.md) | Visión, colas, sockets, alarmas, webhooks (narrativa) |
| [`posicion-valida-gateway.md`](./posicion-valida-gateway.md) | Análisis R1 para Gateway |
| Guías `consumo-*.md` | Consumo Angular |
| Guías `webhook-*.md` | Receptores / contratos webhook |
| `FLUJO-*.md` | Flujos Auth, S3, Clientes, Operadores, … |

---

## 20. Aceptación

Este documento constituye el acuerdo técnico de contratos para NextAPI. Cambios de alcance o especificaciones requieren addendum por escrito aceptado por las partes.

---

*v3.0 — unificación de `contratos.md` (operativo) + `CONTRATO-PROYECTO-NEXTAPI.md` (alcance). Alineado con `docs/contexto.md` (septiembre 2026). Historial previo: v1.5–v1.8 Auth/S3/Clientes/Usuarios.*

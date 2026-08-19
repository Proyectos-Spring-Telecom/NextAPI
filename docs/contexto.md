# NextAPI — contexto

Backend NestJS **NextAPI** (v2.2.0). API de operación para clientes, usuarios, catálogos, SIMs, dispositivos, productos, instalaciones y **alarmas SIA**.

Next es la **fuente de verdad** de negocio. SpringPanel (gateway) parsea SIA TCP, hace ACK al panel y envía JSON firmado a Next. El ACK del panel **no espera** respuesta de Next.

```text
Front (JWT) ──REST/Socket.IO──► NextAPI ──MySQL──► tablas de negocio
                                      ▲
AX PRO ──SIA TCP──► SpringPanel ──────┘  POST HMAC /api/alarmas/ingest*
```

## Stack y convenciones

| Tema | Valor |
|------|--------|
| Runtime | NestJS 11, TypeORM, MySQL |
| Prefijo HTTP | `/api` |
| Auth usuario | JWT Bearer (`Authorization: Bearer`, esquema Swagger `bearer-token`) |
| Auth gateway | HMAC-SHA256 + timestamp (±5 min); JWT de usuario **no** aplica |
| Validación | `ValidationPipe`: whitelist, forbidNonWhitelisted, transform |
| ORM | `synchronize: false` — el DDL se aplica en la BD, no desde entidades |
| JSON | camelCase; PKs bigint como **número** (`bigNumberStrings: false`) |
| Estatus típico | `1` activo, `0` inactivo (salvo ciclo de recurso SIM/dispositivo) |
| Bitácora | altas/cambios relevantes con `EnumModulos` |
| Zona horaria proceso | `America/Mexico_City` (salvo `TZ` en entorno) |
| Puerto local | `PORT` o `3004` |

Swagger UI: ruta HTTP `/docs` (no es esta carpeta). Contratos HTTP detallados: [contratos.md](./contratos.md).

## Tenant (filtro por rol)

JWT trae `userId`, `idCliente`, `rol`.

| Rol | Alcance en listados |
|-----|---------------------|
| **1, 2, 3, 4, 5, 8** | Todo (sin filtro de cliente). `?idCliente` opcional |
| **6** | Cliente del token **y descendientes** (`CALL spGetClientes(?)`) |
| **7 y cualquier otro** | Solo `idCliente` del token |

En **alarmas**, si `?idCliente` está fuera del set → **403**. En otros módulos el filtro de listado suele recortar el resultado (GET por id de otro cliente puede ser 404).

Implementación: `src/common/tenant-filter/tenant-filter.service.ts`.

## Módulos de catálogo (`EnumModulos`)

| Id | Módulo | Implementado en API |
|----|--------|---------------------|
| 1 | Clientes | Sí |
| 2 | Usuarios | Sí |
| 3 | Roles | Sí |
| 4 | Permisos | Sí |
| 5 | Módulos | Sí |
| 14 | SIMs | Sí |
| 15 | Dispositivos | Sí |
| 16 | Vehículos | Sí (`productos/vehiculos`) |
| 17 | Instalaciones | Sí |
| 18 | Operadores | Sí |
| 19 | Licencias | Id de catálogo; **sin** módulo HTTP propio |
| 20 | Inmuebles | Sí (`productos/inmuebles`) |
| 21 | Paneles | Sí (`dispositivos/paneles`) |
| 22 | Alarmas | Sí (REST + ingest + socket) |
| 23 | Reportes | Id de catálogo; **sin** módulo HTTP propio |
| 24 | Activos | Sí (`productos/activos`) |
| 25 | Personas | Sí (`productos/personas`) |

No hay módulo “Productos” en el catálogo. El alta va por el subtipo (vehículo, inmueble, activo, persona).

## Funcionalidades implementadas

### Autenticación

- Login usuario/contraseña (`POST /api/login`, query opcional `Nombres` de solución; default `NXT`).
- Login operador por NIP (`POST /api/login/operador/accesso/nip`).
- Refresh y logout de sesión (`refreshToken`).
- Perfil `GET /api/login/me`.
- Cambio de contraseña autenticado.
- Verificación de código (`PATCH /api/login/verify`).
- Recuperación de contraseña (solicitud + confirmación) con correo.
- Login facial `POST /api/auth/validateFace` (proxy BehaviorIQ; `idCliente` fijo en servidor).
- Throttling por endpoint de auth (límites en env).
- JWT access con `type: 'access'`. En `req.user`: `userId`, `email`, `idCliente`, `rol`, `idOperador`, opcional `face`.

### Administración

- **Clientes:** alta (multipart), listados, jerarquía, GET, PATCH, estatus.
- **Usuarios:** alta (multipart), listados (global y por cliente), GET, PATCH, estatus, contraseña, NIP propio, face-auth.
- **Roles, permisos, módulos:** alta, listados, GET, PUT, estatus; permisos agrupados.
- **Operadores:** alta, listados, GET, PATCH, estatus.
- **Bitácora:** consulta paginada y por id (`GET list` obsoleto).

### Catálogos

CRUD (y estatus) para combustible, telefonía, planes de telefonía, marcas y modelos.

- Telefonía: `GET /:idTelefonia/planes`.
- Marcas: `GET /:id/modelos`.
- Registry: `GET /api/catalogos/:nombreCatalogo` (`cat-tipo-combustible`, `cat-telefonia`, `cat-planes-telefonia`, `cat-marcas`, `cat-modelos`).

### Inventario operativo

- **SIMs:** alta, listados, GET, PATCH, estatus.
- **Dispositivos (padre):** rastreador / AVL / teléfono. `POST` exige `idCliente` + `idTipoDispositivo`. Tipo panel → 400 (usar paneles). Listado `GET /list`, paginado `GET /paginado/:page/:limit`. GET plano (`id`, `idX` + `nombreX`). `PATCH` y `PATCH estatus/:id` con `{ estatus: 0 \| 1 }`.
- **Paneles:** `POST /api/dispositivos/paneles` crea `Dispositivos` + `PanelAlarma` (1:1, PK `IdDispositivo`) en transacción. Tipo por `CatTipoDispositivo.codigo` `PANEL` \| `PANEL_ALARMA` \| `PAN`. GET plano; **`aesKey` no se expone**.
- **Productos (padre):** sin POST. List / paginado / GET / PATCH nombre / PATCH estatus. Query `idTipoProducto` e `idCliente` (el de cliente respeta tenant, no es bypass).
- **Subtipos de producto:** vehículos, inmuebles, activos, personas. Cada POST crea cabecera `Productos` + detalle. GET: JSON **plano**, `id` (no `idProducto` como nombre de campo), campos de hija prefijados. Vehículos: multipart; interceptor quita campos `foto` vacíos de Swagger.
- **Instalaciones:** alta, listados, GET, PATCH, estatus. Cruce dispositivo / producto / SIM.

### Archivos y correo

- **S3:** `POST /api/s3/upload`, `PATCH /api/s3/update` (sube nuevo y opcionalmente borra `oldUrl`). JWT. Carpetas: `clientes`, `operadores`, `usuarios`, `vehiculos`, `pasajeros`. Tipos PNG, JPEG, PDF.
- **Mail:** servicio interno (recuperación, etc.). El controller `mail` no expone rutas.

### Alarmas SIA

- Ingest HMAC: evento de negocio e heartbeat `RP` (el heartbeat **no** escribe historial).
- Idempotencia `GatewayIngestLog` por `idempotencyKey` (64 hex).
- `EventoAlarma` + UPSERT `UltimoEventoAlarma` si hay panel. Huérfanos `Estatus = 0`, sin socket.
- Heartbeat: `UPDATE PanelAlarma.UltimoHeartbeat`. Online = `(now - UltimoHeartbeat) < SIA_OFFLINE_THRESHOLD_MS` (default 10 min).
- REST de paneles, últimos eventos e historial con filtro de rol.
- Socket.IO namespace `/alarmas`, rooms `panel:{IdDispositivo}`.
- Job ~5 min: `panel:estado` si cambió online/offline.
- Next **no** re-parsea SIA; copia `tipoEvento`, `severidad`, zona vs `codigoUsuario` del gateway.

### Webhooks salientes

Emisor HMAC a URLs de `WEBHOOK_SUBSCRIBERS`:

- `vehiculo.created` / `updated` / `deleted`
- `cliente.created` / `updated`

## Modelo de datos (alarmas)

- `PanelAlarma.IdDispositivo` = `Dispositivos.Id` = `EventoAlarma.IdPanel` = room socket.
- `UltimoEventoAlarma.IdPanel` unique, mismo id.
- `GatewayIngestLog`: PK `IdempotencyKey`. Tabla creada en BD (entidad TypeORM solo mapea).

## Variables de entorno (nombres)

No versionar valores. Archivo local `.env` (gitignored).

Típicas: `DB_*`, `JWT_*`, throttles de auth, `AWS_*`, `UPLOAD_MAX_SIZE`, SMTP (`HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD`).

Alarmas / gateway:

- `GATEWAY_HMAC_SECRET` (≥16) igual a `NEXT_INGEST_HMAC_SECRET` en SpringPanel
- `GATEWAY_API_KEY` opcional; si tiene valor, el gateway envía `X-Gateway-Key`
- `SIA_OFFLINE_THRESHOLD_MS` (default `600000`)

Opcionales: `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET`, `BEHAVIORIQ_*`.

## Seguridad al versionar

`.env` está en `.gitignore`. El código solo usa **nombres** de variables. No hacer `git add -f .env`.

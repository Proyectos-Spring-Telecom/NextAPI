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
| Bitácora | altas/cambios relevantes con `EnumModulos` |
| Fechas de negocio | Utilidades México (`nowMexicoCityMysql` / `nowMexicoCityAsUtcDate`) en auth, instalaciones, bitácora, etc. |
| Zona horaria proceso | `America/Mexico_City` (salvo `TZ` en entorno) |
| Puerto local | `PORT` o `3004` |

Swagger UI: ruta HTTP `/docs` (no es esta carpeta). Contratos HTTP: [contratos.md](./contratos.md). Webhooks Shift: [webhook-shiftcontrol.md](./webhook-shiftcontrol.md).

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

No hay módulo “Productos” en el catálogo de bitácora como alta genérica. El alta va por el subtipo (vehículo, inmueble, activo, persona). Existe CRUD genérico de lectura/estatus/nombre en `/api/productos`.

---

## Estatus operativos

### Productos / dispositivos / paneles — `EnumEstatusProductoDispositivo`

| Valor | Nombre |
|-------|--------|
| 0 | INACTIVO |
| 1 | ACTIVO (disponible) |
| 2 | ASIGNADO |
| 3 | BAJA_REMPLAZO |
| 4 | BAJA_MANTENIMIENTO |
| 5 | INSERVIBLE |

- `PATCH .../estatus/:id` acepta **0–5**.
- Si el estatus **actual** es **2 (ASIGNADO)**, se rechaza con 400: el componente está en una instalación. Helper: `assertEstatusNoAsignado` (`src/common/assert-estatus-no-asignado.util.ts`).
- Aplica a: productos, vehículos, inmuebles, activos, personas, dispositivos, paneles y SIMs.

### SIMs — `EnumEstatusRecurso`

| Valor | Nombre |
|-------|--------|
| 0 | BAJA |
| 1 | DISPONIBLE |
| 2 | ASIGNADO |
| 3 | REVISION |
| 4 | REMOVIDO |

`PATCH /api/sims/estatus/:id` alterna **1 ↔ 0** (sin body). Si actual es **2**, se bloquea igual que arriba.

### Instalaciones — `EnumEstatusInstalacion`

| Valor | Nombre |
|-------|--------|
| 0 | INACTIVO |
| 1 | ACTIVA |
| 2 | ASIGNADO |
| 3 | BAJA_REMPLAZO |
| 4 | BAJA_MANTENIMIENTO |
| 5 | INSERVIBLE |

- Columna de negocio: `EstatusInstalacion`.
- Columna de fila `Estatus` (tinyint): controla columnas generadas `DispositivoActivo` / `SimActivo` (únicas por cliente cuando la fila está activa).

---

## Funcionalidades implementadas

### Autenticación (`/api/login`, `/api/auth`)

- Login usuario/contraseña; query opcional de solución (`Nombres`, default `NXT`).
- Login operador por NIP.
- Refresh y logout de sesión (`refreshToken`).
- Perfil `GET /api/login/me`.
- Cambio de contraseña autenticado.
- Verificación de código (`PATCH /api/login/verify`).
- Recuperación de contraseña (solicitud + confirmación) con correo.
- Login facial `POST /api/auth/validateFace` (proxy BehaviorIQ; credenciales solo en servidor).
- Throttling por endpoint (límites vía `THROTTLE_*`).

### Clientes, usuarios, IAM

- Clientes: alta multipart, lista, jerarquía, paginado, estatus.
- Usuarios: alta multipart, face-auth, lista por cliente, paginado, contraseña propia, NIP (`mi-nip`), estatus.
- Roles, permisos (incl. agrupados), módulos: CRUD + estatus.
- Operadores: CRUD + estatus (NIP).
- Bitácora: consulta paginada / por id.

### Catálogos

- Tipo combustible, telefonía (+ planes por telefonía), planes de telefonía, marcas (+ modelos por marca), modelos.
- Registry genérico `GET /api/catalogos/:nombreCatalogo`.

### SIMs

- Alta con estatus inicial disponible (1); IMEI único.
- Lista solo disponibles; paginado con todos los estatus visibles según reglas del servicio.
- Toggle estatus 1↔0; bloqueo si ASIGNADO (2).
- Update parcial (sin cambiar estatus por ese endpoint).

### Dispositivos y paneles

- Dispositivos (GPS/AVL/teléfono): CRUD; `imei` bigint nullable único; no crear tipo panel por esta ruta.
- Paneles: transacción `Dispositivos` + `PanelAlarma` (PK = `IdDispositivo`); `cuentaSia` única; **`aesKey` nunca en GET**.
- Tipo panel: `CatTipoDispositivo` con código `PANEL` / `PANEL_ALARMA` / `PAN` (`EnumTipoDispositivo.PANEL_ALARMA = 2`).
- Estatus 0–5 en dispositivo (y panel); bloqueo si ASIGNADO (2).

### Productos y subtipos

- Lectura/estatus/nombre en `/api/productos`.
- Alta y detalle por subtipo:
  - **Vehículos** (multipart fotos/documentos; búsqueda por placa).
  - **Activos**, **Inmuebles**, **Personas**.
- Estatus 0–5; bloqueo si ASIGNADO (2).
- Webhooks de vehículo: `vehiculo.created` / `vehiculo.updated` / `vehiculo.deleted` (baja lógica con estatus 0, 3, 4 o 5).

### Instalaciones (vinculación producto ↔ dispositivo ↔ SIM)

- **Alta:** producto obligatorio (estatus 1 + mismo cliente); dispositivo/SIM opcionales (estatus 1). Tras insertar, componentes → **ASIGNADO (2)**.
- **Update (`PATCH /:id`):** archiva vigente en `HistoricoInstalaciones`, crea nueva ACTIVA, migra `UsuariosInstalaciones` al nuevo id y elimina la fila anterior. Requiere `estatusInstalacionAnterior` (histórico). Al cambiar recursos salientes: body `estatusProductoAnterior` / `estatusDispositivoAnterior` / `estatusSimAnterior` (0–5). Entrantes deben estar en 1 y pasan a 2.
- **PATCH estatus (`/:estatus/:id`):** solo **0, 1, 5**. No archiva.
  - **0 / 5:** instalación a ese estatus; fila `Estatus=0` (libera activos); componentes → disponible (1).
  - **1:** componentes deben estar en 1; instalación activa (`Estatus=1`); componentes → ASIGNADO (2).
- **List** instalaciones con fila activa.
- **Histórico** por id (cadena reciente → antiguo).
- **Paginado** `POST /paginado` por `idTipoProducto` (1–4).
- **Detalle** `GET /:id` con mismos bloques y más campos que el paginado.

Helpers: `src/instalaciones/helpers/instalaciones-paginado.helpers.ts`, `instalaciones-detalle.helpers.ts`.

#### Nomenclatura y orden del JSON (paginado / detalle)

Orden fijo, plano (sin anidar):

1. Instalación  
2. Cliente  
3. Producto + detalle del tipo  
4. Dispositivo (+ Panel si tipo 2)  
5. SIM  

Sufijos: `…Dispositivo`, `…Panel`, `…Vehiculo` / `…Activo` / `…Inmueble` / `…Persona`, `…Sim`.  
Panel: nunca `aesKey`.

### Alarmas SIA

- Consulta JWT: paneles, últimos eventos, historial, detalle.
- Ingest HMAC (sin JWT): `POST /api/alarmas/ingest`, `.../ingest/heartbeat`.
- Gateway: `GATEWAY_HMAC_SECRET`, opcional `GATEWAY_API_KEY`.
- Socket.IO para push a front (mismo origen Nest).
- Offline de paneles por umbral `SIA_OFFLINE_THRESHOLD_MS` / scheduler.

### Telemetría (entidades)

- `Posiciones`: histórico GPS por IMEI.
- `UltimaPosicion`: snapshot 1:1 por IMEI.

### Infra transversal

- S3: upload / update de archivos.
- Mail: SMTP (servicio; controller sin rutas de negocio).
- **Webhooks salientes** hacia ShiftControl (y otros suscriptores): HMAC-SHA256 con `WEBHOOK_SECRET`; destinos en `WEBHOOK_SUBSCRIBERS` (URLs separadas por coma).

#### Webhooks implementados

| Evento | Origen |
|--------|--------|
| `vehiculo.created` | Alta de vehículo |
| `vehiculo.updated` | Update de vehículo |
| `vehiculo.deleted` | PATCH estatus vehículo → 0, 3, 4 o 5 |
| `cliente.created` | Alta de cliente |
| `cliente.updated` | Update de cliente |

Envelope: `event`, `timestamp`, `tenantId`, `entityId`, `data`, `signature`.

`data` vehículo: `placa`, `marcaNombre`, `modeloNombre`, `fotoFrente`.  
`data` cliente: `idPadre`.

Detalle y checklist para Shift: [webhook-shiftcontrol.md](./webhook-shiftcontrol.md).

---

## Entidades clave

| Entidad | Rol |
|---------|-----|
| `Instalaciones` | Versión vigente; `EstatusInstalacion` + `Estatus`; `DispositivoActivo` / `SimActivo` generadas |
| `HistoricoInstalaciones` | Versiones archivadas en update |
| `Productos` + `Vehiculos` / `Activos` / `Inmuebles` / `Personas` | Producto tipado |
| `Dispositivos` + `PanelAlarma` | Equipo; panel 1:1 |
| `Sims` | Línea / ICC |
| `Posiciones` / `UltimaPosicion` | Telemetría por IMEI |
| `EventoAlarma` / `UltimoEventoAlarma` / `GatewayIngestLog` | Flujo SIA |
| `CatEstatusInstalacion`, `CatTipoProducto`, `CatTipoDispositivo` | Tipificación |

---

## Variables de entorno (nombres)

| Grupo | Variables |
|-------|-----------|
| Runtime | `PORT`, `TZ`, `DATABASE_URL` |
| MySQL | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_TZ` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_CONFIRMACION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| Throttle | `THROTTLE_LOGIN_*`, `THROTTLE_PIN_*`, `THROTTLE_VERIFY_*`, `THROTTLE_RECUPERACION_*`, `THROTTLE_REFRESH_*`, `THROTTLE_LOGOUT_*`, `THROTTLE_VALIDATE_FACE_*` |
| AWS S3 | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `UPLOAD_MAX_SIZE` |
| Mail | `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD`, `MAIL_FRONTEND_URL` |
| Gateway | `GATEWAY_HMAC_SECRET`, `GATEWAY_API_KEY`, `SIA_OFFLINE_THRESHOLD_MS` |
| Webhooks | `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET` |
| BehaviorIQ | `BEHAVIORIQ_BASE_URL`, `BEHAVIORIQ_USER_NAME`, `BEHAVIORIQ_PASSWORD`, `BEHAVIORIQ_LOGIN_TIMEOUT_MS`, `BEHAVIORIQ_VALIDATE_TIMEOUT_MS` |

`.env` **no se versiona** (ver `.gitignore`).

---

## Documentación relacionada

| Archivo | Uso |
|---------|-----|
| [contratos.md](./contratos.md) | Contratos HTTP (rutas, bodies, auth) |
| [webhook-shiftcontrol.md](./webhook-shiftcontrol.md) | Contrato webhook Next → ShiftControl |
| [BACKEND-CONTEXT.md](./BACKEND-CONTEXT.md) | Contexto técnico ampliado (legacy / detalle) |
| [CONTEXTO-PROYECTO.md](./CONTEXTO-PROYECTO.md) | Visión de producto |
| [CONTRATO-PROYECTO-NEXTAPI.md](./CONTRATO-PROYECTO-NEXTAPI.md) | Alcance / entregables de proyecto |

Fuente de verdad operativa: **este archivo** + **contratos.md** + **webhook-shiftcontrol.md** + Swagger `/docs`.

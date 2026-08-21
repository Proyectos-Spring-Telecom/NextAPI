# NextAPI — contratos

Prefijo global: **`/api`**. JSON camelCase. IDs numéricos (no string). Swagger interactivo: `/docs`.

Auth de usuario (salvo login, verify, refresh, logout, recuperación, ingest HMAC y `validateFace`):

```http
Authorization: Bearer <accessToken>
```

Errores `HttpException`: cuerpo **texto plano** (filtro global), no JSON `{ message }`.

Contexto de negocio: [contexto.md](./contexto.md).

## Respuestas comunes

Alta / update / estatus:

```json
{ "status": "success", "message": "...", "data": { "id": 1, "nombre": "..." } }
```

Listado paginado (mayoría de módulos):

```json
{
  "data": [],
  "paginated": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

### Estatus producto / dispositivo / panel

Body en `PATCH .../estatus/:id`:

```json
{ "estatus": 0 | 1 | 2 | 3 | 4 | 5 }
```

| Valor | Significado |
|-------|-------------|
| 0 | Inactivo |
| 1 | Activo / disponible |
| 2 | Asignado |
| 3 | Baja reemplazo |
| 4 | Baja mantenimiento |
| 5 | Inservible |

Si el estatus **actual** del recurso es **2**, la API responde **400** con mensaje formal (*…se encuentra asignado a una instalación*).

### Estatus SIM

`PATCH /api/sims/estatus/:id` **sin body**: alterna `1 ↔ 0`. Si actual es **2**, **400** (mismo criterio).

---

## Autenticación

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| POST | `/api/login` | no | Body `userName`, `password`. Query `Nombres` (solución; default `NXT`) |
| POST | `/api/login/operador/accesso/nip` | no | NIP de operador. Query `Nombres` |
| GET | `/api/login/me` | JWT | Perfil del token |
| POST | `/api/login/cambiar/accesso` | JWT | Cambio de contraseña |
| PATCH | `/api/login/verify` | no | Código de confirmación |
| POST | `/api/login/refresh` | no | Body `refreshToken` |
| POST | `/api/login/logout` | no | Body `refreshToken` |
| POST | `/api/login/usuario/solicitud/recuperacion` | no | |
| POST | `/api/login/recuperar/confirmacion` | no | |
| POST | `/api/auth/validateFace` | no | Login facial; tenant fijo en servidor |

JWT access: claim `type = access`. En request: `userId`, `email`, `idCliente`, `rol`, `idOperador`, opcional `face`.

---

## Clientes

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/clientes` | Multipart |
| GET | `/api/clientes/list` | |
| GET | `/api/clientes/jerarquia` | |
| GET | `/api/clientes/list/:cliente` | |
| GET | `/api/clientes/:page/:limit` | |
| GET | `/api/clientes/:id` | |
| PATCH | `/api/clientes/:id` | |
| PATCH | `/api/clientes/estatus/:id` | `{ estatus }` |

---

## Usuarios

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/usuarios` | Multipart |
| POST | `/api/usuarios/face-auth` | Registrar IdFaceAuth |
| GET | `/api/usuarios/list` | |
| GET | `/api/usuarios/list/cliente/:id` | |
| GET | `/api/usuarios/:page/:limit` | |
| GET | `/api/usuarios/:id` | |
| PATCH | `/api/usuarios/estatus/:id` | |
| PATCH | `/api/usuarios/actualizar/contrasena` | Contraseña del usuario autenticado |
| PATCH | `/api/usuarios/mi-nip` | Crear / actualizar NIP |
| PATCH | `/api/usuarios/:id` | |

---

## Roles / permisos / módulos / operadores / bitácora

| Método | Ruta | Notas |
|--------|------|--------|
| POST/GET/PUT/PATCH | `/api/roles`… | CRUD + `estatus/:id` |
| POST/GET/PUT/PATCH | `/api/permisos`… | Incluye `permisosAgrupados`; estatus `PATCH :id/estatus` |
| POST/GET/PUT/PATCH | `/api/modulos`… | CRUD + `PATCH :id/estatus` |
| POST/GET/PATCH | `/api/operadores`… | CRUD + `estatus/:id` |
| GET | `/api/bitacora/:page/:limit`, `/api/bitacora/:id` | Consulta |

---

## Catálogos

| Prefijo | Notas |
|---------|--------|
| `/api/cat-tipo-combustible` | CRUD + list / paginado / estatus |
| `/api/cat-telefonia` | + `GET /:idTelefonia/planes` |
| `/api/cat-planes-telefonia` | CRUD + list |
| `/api/cat-marcas` | + `GET /:id/modelos` |
| `/api/cat-modelos` | CRUD + list / paginado / estatus |
| `/api/catalogos/:nombreCatalogo` | Solo GET lista (registry) |

---

## SIMs — `/api/sims`

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/sims` | Alta; estatus inicial 1; IMEI único |
| GET | `/api/sims/list` | Solo `estatus = 1` |
| GET | `/api/sims/:page/:limit` | Paginado |
| GET | `/api/sims/:id` | Detalle |
| PATCH | `/api/sims/estatus/:id` | Toggle 1↔0; **400 si actual = 2** |
| PATCH | `/api/sims/:id` | Update parcial (**no** estatus) |

---

## Dispositivos — `/api/dispositivos`

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/dispositivos` | Alta (no tipo panel) |
| GET | `/api/dispositivos/list` | Query `idTipoDispositivo`, `idCliente` |
| GET | `/api/dispositivos/paginado/:page/:limit` | |
| GET | `/api/dispositivos/:id` | |
| PATCH | `/api/dispositivos/estatus/:id` | `{ estatus: 0–5 }`; **400 si actual = 2** |
| PATCH | `/api/dispositivos/:id` | |

### Paneles — `/api/dispositivos/paneles`

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/dispositivos/paneles` | Dispositivo + PanelAlarma; no devuelve `aesKey` |
| GET | `/api/dispositivos/paneles/list` | Plano |
| GET | `/api/dispositivos/paneles/:page/:limit` | |
| GET | `/api/dispositivos/paneles/:id` | `id` = IdDispositivo |
| PATCH | `/api/dispositivos/paneles/estatus/:id` | 0–5; **400 si actual = 2** |
| PATCH | `/api/dispositivos/paneles/:id` | |

---

## Productos — `/api/productos`

| Método | Ruta | Notas |
|--------|------|--------|
| GET | `/api/productos/list` | Query `idTipoProducto`, `idCliente` |
| GET | `/api/productos/paginado/:page/:limit` | |
| GET | `/api/productos/:id` | + cliente + tipo |
| PATCH | `/api/productos/estatus/:id` | 0–5; **400 si actual = 2** |
| PATCH | `/api/productos/:id` | Nombre |

Alta solo por subtipo.

### Vehículos — `/api/productos/vehiculos`

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/productos/vehiculos` | Multipart |
| GET | `/api/productos/vehiculos/list` | Activos |
| GET | `/api/productos/vehiculos/placa/:placa` | Tenant |
| GET | `/api/productos/vehiculos/:page/:limit` | |
| GET | `/api/productos/vehiculos/:id` | IdProducto |
| PATCH | `/api/productos/vehiculos/estatus/:id` | 0–5; bloqueo ASIGNADO |
| PATCH | `/api/productos/vehiculos/:id` | |

### Activos / inmuebles / personas

Mismo patrón bajo:

- `/api/productos/activos`
- `/api/productos/inmuebles`
- `/api/productos/personas`

`POST`, `GET list`, `GET :page/:limit`, `GET :id`, `PATCH estatus/:id` (0–5 + bloqueo), `PATCH :id`.

`idTipoProducto`: **1** vehículo, **2** activo, **3** inmueble, **4** persona.

---

## Instalaciones — `/api/instalaciones`

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| POST | `/api/instalaciones` | JWT | Alta ACTIVA; componentes 1 → 2 |
| GET | `/api/instalaciones/list` | JWT | Filas con `Estatus = 1` |
| GET | `/api/instalaciones/historico/:id` | JWT | Cadena histórico |
| POST | `/api/instalaciones/paginado` | JWT | Body paginado por tipo producto |
| GET | `/api/instalaciones/:id` | JWT | Detalle completo |
| PATCH | `/api/instalaciones/estatus/:id` | JWT | Solo **0, 1, 5**; no archiva |
| PATCH | `/api/instalaciones/:id` | JWT | Archiva + nueva versión ACTIVA |

### Body `POST /paginado`

```json
{ "page": 1, "limit": 20, "idTipoProducto": 3 }
```

`idTipoProducto`: 1–4. Respuesta: `data[]` + `paginated`.

### Orden y nomenclatura del ítem (paginado y detalle)

1. Instalación → 2. Cliente → 3. Producto + detalle → 4. Dispositivo (+ Panel si tipo 2) → 5. SIM  

Sufijos: `…Dispositivo`, `…Panel`, `…Vehiculo|Activo|Inmueble|Persona`, `…Sim`. Sin `aesKey`.

**Detalle** incluye además: `idHistoricoInstalacion`, `dispositivoActivo`, `simActivo`, fechas de producto/dispositivo/panel/SIM, plan telefonía, fotos extra de vehículo, etc.

### `PATCH /estatus/:id` — body

```json
{ "estatus": 0 | 1 | 5 }
```

| Valor | Efecto |
|-------|--------|
| 0 o 5 | `EstatusInstalacion` = valor; fila `Estatus = 0`; componentes → 1 |
| 1 | Componentes deben estar en 1; instalación activa; componentes → 2 |

### `PATCH /:id` (update) — reglas

- Archiva vigente → histórico; inserta nueva ACTIVA.
- Body incluye `estatusInstalacion` (contexto histórico; allowlist 0,1,3,4,5).
- Si cambia producto/dispositivo/SIM saliente: enviar `estatusProductoAnterior` / `estatusDispositivoAnterior` / `estatusSimAnterior` (0–5).
- Entrantes: deben estar en estatus **1** y mismo `idCliente`; pasan a **2**.

### Alta — body (campos principales)

- `idCliente`, `idProducto` (obligatorios)
- `idDispositivo`, `idSim` (opcionales)
- Componentes en 1 al asignar.

---

## Alarmas — `/api/alarmas`

### Consulta (JWT)

| Método | Ruta | Notas |
|--------|------|--------|
| GET | `/api/alarmas/paneles` | Paneles activos; tenant |
| GET | `/api/alarmas/paneles/:id` | `id` = IdDispositivo |
| GET | `/api/alarmas/ultimos-eventos` | Último por panel |
| GET | `/api/alarmas/eventos` | Historial (filtros query) |
| GET | `/api/alarmas/eventos/:id` | Detalle |

### Ingest (HMAC, sin JWT)

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/alarmas/ingest` | Evento SIA |
| POST | `/api/alarmas/ingest/heartbeat` | Heartbeat RP |

Headers típicos de gateway: timestamp + firma HMAC (`GATEWAY_HMAC_SECRET`); opcional `X-Gateway-Key` si `GATEWAY_API_KEY` está definida.

Socket.IO: eventos de alarma hacia clientes autenticados (mismo proceso Nest).

---

## S3

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/s3` (upload) | Archivo → bucket |
| PATCH | `/api/s3` (update) | Reemplazo |

---

## Webhooks salientes

Config: `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET`.  
Emisión HMAC hacia suscriptores (p. ej. baja de vehículo). No es un endpoint de entrada de Next.

---

## Mail

Servicio SMTP interno. Controller `/api/mail` sin rutas de negocio expuestas.

---

## Códigos de error frecuentes

| HTTP | Cuándo |
|------|--------|
| 400 | Validación DTO; estatus ASIGNADO al PATCH; reglas de instalación |
| 401 | Sin / JWT inválido |
| 403 | Tenant fuera de alcance (p. ej. alarmas + `idCliente`) |
| 404 | Recurso no encontrado o fuera de tenant |
| 409 | Conflictos de unicidad (IMEI, cuenta SIA, etc.) |

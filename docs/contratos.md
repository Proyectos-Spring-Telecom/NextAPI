# NextAPI — contratos

Prefijo global: **`/api`**. JSON camelCase. IDs numéricos (no string). Swagger interactivo: `/docs`.

Auth de usuario (salvo login, verify, refresh, logout, recuperación, ingest HMAC y `validateFace`):

```http
Authorization: Bearer <accessToken>
```

Errores `HttpException`: cuerpo **texto plano** (filtro global), no JSON `{ message }`.

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

Estatus de recurso: body `{ "estatus": 0 | 1 }` en `PATCH .../estatus/:id` (o `PATCH :id/estatus` en módulos/permisos).

JSON público de alarmas/productos/dispositivos: **nunca** exponer `idDispositivo` / `idProducto` como nombre de campo. Usar `id`, `idPanel`, `idInmueble`.

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
| POST | `/api/usuarios/face-auth` | |
| GET | `/api/usuarios/list` | |
| GET | `/api/usuarios/list/cliente/:id` | |
| GET | `/api/usuarios/:page/:limit` | |
| GET | `/api/usuarios/:id` | |
| PATCH | `/api/usuarios/:id` | |
| PATCH | `/api/usuarios/estatus/:id` | |
| PATCH | `/api/usuarios/actualizar/contrasena` | |
| PATCH | `/api/usuarios/mi-nip` | |

---

## Roles, permisos, módulos, bitácora, operadores

### Roles — `/api/roles`

POST, GET `list`, GET `:page/:limit`, GET `:id`, PUT `:id`, PATCH `estatus/:id`.

### Permisos — `/api/permisos`

POST, GET `list`, GET `permisosAgrupados`, GET `:page/:limit`, GET `:id`, PUT `:id`, PATCH `:id/estatus`.

### Módulos — `/api/modulos`

POST, GET `list`, GET `:page/:limit`, GET `:id`, PUT `:id`, PATCH `:id/estatus`.

### Bitácora — `/api/bitacora`

GET `list` (obsoleto), GET `:page/:limit`, GET `:id`.

### Operadores — `/api/operadores`

POST, GET `list`, GET `:page/:limit`, GET `:id`, PATCH `:id`, PATCH `estatus/:id`.

---

## Catálogos

| Recurso | Base | Extra |
|---------|------|--------|
| Combustible | `/api/cat-tipo-combustible` | POST, list, `:page/:limit`, `:id`, PATCH, `estatus/:id` |
| Telefonía | `/api/cat-telefonia` | + GET `/:idTelefonia/planes` |
| Planes telefonía | `/api/cat-planes-telefonia` | GET `/` además de list/paginado |
| Marcas | `/api/cat-marcas` | + GET `/:id/modelos` |
| Modelos | `/api/cat-modelos` | POST, list, paginado, `:id`, PATCH, `estatus/:id` |
| Registry | `/api/catalogos/:nombreCatalogo` | Solo GET lista |

Nombres del registry: `cat-tipo-combustible`, `cat-telefonia`, `cat-planes-telefonia`, `cat-marcas`, `cat-modelos`.

---

## SIMs — `/api/sims`

POST, GET `list`, GET `:page/:limit`, GET `:id`, PATCH `:id`, PATCH `estatus/:id`.

---

## Dispositivos

### Padre — `/api/dispositivos`

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/api/dispositivos` | Rastreador/AVL/teléfono. Panel → 400 |
| GET | `/api/dispositivos/list` | Query `idTipoDispositivo`, `idCliente` |
| GET | `/api/dispositivos/paginado/:page/:limit` | |
| GET | `/api/dispositivos/:id` | Plano |
| PATCH | `/api/dispositivos/:id` | |
| PATCH | `/api/dispositivos/estatus/:id` | `{ estatus: 0 \| 1 }` |

GET plano: `id`, `numeroSerie`, `imei`, `eco`, `estatus`, `idCliente`, `nombreCliente`, `idTipoDispositivo`, `nombreTipoDispositivo`, `codigoTipoDispositivo`, `idMarca`, `nombreMarca`, `idModelo`, `nombreModelo`, fechas.

### Paneles — `/api/dispositivos/paneles`

POST (transacción dispositivo + panel), GET `list`, GET `:page/:limit`, GET `:id`, PATCH `:id`, PATCH `estatus/:id`.

GET plano: `id` (= `IdDispositivo`), `nombrePanel`, `cuentaSia`, `ip`, `cifradoActivo`, `aesBits`, `ultimoHeartbeat` + campos del dispositivo. **Sin `aesKey`.**

---

## Productos

### Padre — `/api/productos`

Sin POST (el alta es por subtipo).

| Método | Ruta | Notas |
|--------|------|--------|
| GET | `/api/productos/list` | Query `idTipoProducto`, `idCliente` (tenant) |
| GET | `/api/productos/paginado/:page/:limit` | Query `idTipoProducto` |
| GET | `/api/productos/:id` | Incluye `cliente` y `tipoProducto` |
| PATCH | `/api/productos/:id` | Nombre |
| PATCH | `/api/productos/estatus/:id` | `{ estatus: 0 \| 1 }` |

`EnumTipoProducto`: 1 vehículo, 2 activo, 3 inmueble, 4 persona.

### Subtipos

Mismo patrón en cada uno: POST, GET `list`, GET `:page/:limit`, GET `:id`, PATCH `:id`, PATCH `estatus/:id`.

| Base | Extra |
|------|--------|
| `/api/productos/vehiculos` | GET `placa/:placa`; multipart fotos |
| `/api/productos/inmuebles` | |
| `/api/productos/activos` | |
| `/api/productos/personas` | |

GET de subtipo: objeto **plano**. PK en `id`. Campos de la hija prefijados (`nombreActivo`, `nombrePersona`, …). Fechas salen de `Productos`.

---

## Instalaciones — `/api/instalaciones`

POST, GET `list`, GET `:page/:limit`, GET `:id`, PATCH `:id`, PATCH `estatus/:id`.

---

## S3 — `/api/s3`

| Método | Ruta | Body |
|--------|------|------|
| POST | `/api/s3/upload` | multipart: `file`, `folder`, `idModule` |
| PATCH | `/api/s3/update` | multipart: `file`, `folder`, `idModule`, opcional `oldUrl` |

`folder`: `clientes` \| `operadores` \| `usuarios` \| `vehiculos` \| `pasajeros`.

---

## Alarmas — ingest (SpringPanel, sin JWT)

Firma (byte a byte, **raw body**):

```text
HMAC-SHA256(GATEWAY_HMAC_SECRET, `${timestamp}.${rawBody}`).digest('hex')
```

| Header | Obligatorio | Valor |
|--------|-------------|--------|
| `Content-Type` | sí | `application/json` |
| `X-Gateway-Timestamp` | sí | epoch ms |
| `X-Gateway-Signature` | sí | HMAC hex 64 |
| `Idempotency-Key` | sí | SHA-256 hex = `body.idempotencyKey` |
| `X-Gateway-Key` | si hay `GATEWAY_API_KEY` | API key |

| Situación | HTTP | ¿Gateway reintenta? |
|-----------|------|---------------------|
| Auth / firma / body inválido | 401 / 400 | No (4xx salvo 429) |
| Idempotencia ya procesada | 202 | No |
| Persistido OK | 202 `{ "accepted": true }` | No |
| Error interno / BD | 500 / 503 | Sí |

### `POST /api/alarmas/ingest`

Evento de negocio. **Nunca `RP`.** `tipoEventoEtiqueta` y `esHeartbeat` no se guardan.

Campos: `cuentaSia`, `codigoSia`, `tipoEvento`, `tipoEventoEtiqueta`, `severidad` (1–3), `esRestauracion`, `esHeartbeat: false`, `zona`, `codigoUsuario`, `nombreDispositivo`, `particion`, `seq`, `recibidoEn` (ISO; **este** timestamp, no `now()`), `timestampPanel`, `ipOrigen`, `frameCrudo`, `dataDescifrada`, `idDispositivo` (= `IdPanel`), `idCliente`, `idempotencyKey`.

Flujo: resolver panel por `idDispositivo` o `CuentaSia` → INSERT `EventoAlarma` → si hay panel UPSERT `UltimoEventoAlarma` + socket `evento:nuevo`. Sin panel: `Estatus = 0`, sin upsert ni socket. Si el UPSERT falla, el INSERT **no** se revierte.

### `POST /api/alarmas/ingest/heartbeat`

Solo `RP`. Body: `cuentaSia`, `idDispositivo`, `idCliente`, `ultimoHeartbeat`, `seq`, `ipOrigen`, `idempotencyKey`.

Prohibido: INSERT evento, UPSERT último, emitir `evento:nuevo`. Sin panel: 202 + log (no 4xx).

---

## Alarmas — REST (JWT)

Filtro de rol § tenant. `?idCliente` fuera de alcance → **403**. Detalle: 404 si `Estatus != 1`; 403 si el cliente no entra en el set.

| Método | Ruta | Notas |
|--------|------|--------|
| GET | `/api/alarmas/paneles` | `Estatus=1`, `Nombre ASC`. Inmueble **completo** |
| GET | `/api/alarmas/paneles/:id` | `:id` = `IdDispositivo` |
| GET | `/api/alarmas/ultimos-eventos` | Un item por panel; `ultimoEvento` puede ser `null`. Inmueble **corto** |
| GET | `/api/alarmas/eventos` | Query abajo |
| GET | `/api/alarmas/eventos/:id` | |

Query de eventos:

| Query | Default | Reglas |
|-------|---------|--------|
| `idCliente` | — | Según rol |
| `idPanel` | — | = `IdDispositivo` |
| `codigoSia` | — | Uppercase |
| `desde` / `hasta` | — | ISO sobre `RecibidoEn` |
| `page` | 1 | ≥ 1 |
| `limit` | 20 | 1–100 |

Listado eventos:

```json
{
  "data": [
    {
      "id": 130,
      "idPanel": 1000002,
      "idCliente": 10,
      "codigoSia": "PA",
      "tipoEvento": "panico",
      "tipoEventoEtiqueta": "Pánico",
      "zona": 2,
      "codigoUsuario": null,
      "nombreDispositivo": "Cocina",
      "severidad": 3,
      "recibidoEn": "2026-08-18T22:00:00.000Z",
      "esRestauracion": false,
      "panel": {
        "id": 1000002,
        "cuentaSia": "1002",
        "nombre": "Panel Sede Norte",
        "inmueble": { "id": 1000002, "inmueble": "Edificio", "lat": 19.43, "lng": -99.13 }
      }
    }
  ],
  "paginated": { "total": 130, "page": 1, "limit": 20, "totalPages": 7 }
}
```

Ítem `GET /ultimos-eventos`:

```json
{
  "panel": {
    "id": 1000001,
    "cuentaSia": "1001",
    "nombre": "AX PRO Oficina Central",
    "idCliente": 13,
    "idInmueble": 1000001,
    "ultimoHeartbeat": "2026-08-18T22:00:00.000Z",
    "online": true,
    "estatus": 1,
    "cliente": { "id": 13, "nombre": "Cliente Demo" },
    "inmueble": { "id": 1000001, "inmueble": "Oficina", "lat": 19.43, "lng": -99.13 }
  },
  "ultimoEvento": {
    "id": 6,
    "codigoSia": "NL",
    "tipoEvento": "armado_casa",
    "zona": null,
    "codigoUsuario": 622,
    "nombreDispositivo": "Oficina",
    "severidad": 1,
    "recibidoEn": "2026-08-18T22:00:00.000Z",
    "esRestauracion": false
  }
}
```

`online = (now - UltimoHeartbeat) < SIA_OFFLINE_THRESHOLD_MS`.

Panel en `GET /paneles`: inmueble completo (`id`, `inmueble`, `direccionFiscal`, representante, correo, tel, `lat`, `lng`). En últimos eventos y `evento.panel`: inmueble corto.

Etiquetas `tipoEvento` → `tipoEventoEtiqueta` (mapa en `src/alarmas/sia/sia-codes.map.ts`): intrusion, panico, panico_asalto, desarmado, armado_total, armado_casa, sabotaje, perdida_conexion, restauracion_conexion, desconocido. Fallback: reemplazar `_` por espacio.

---

## Alarmas — Socket.IO

- URL: mismo host; **namespace** `/alarmas` (no pasa por el prefijo `/api`).
- Auth: `handshake.auth.token` (access JWT; se acepta `Bearer …`).
- Rooms: `panel:{idPanel}` con `idPanel` = `IdDispositivo` de paneles `Estatus=1` visibles al rol.
- Al conectar: `conexion:lista` → `{ idsPaneles: number[] }`.
- El cliente **solo escucha**.

| Evento | Cuándo | Payload |
|--------|--------|---------|
| `evento:nuevo` | Tras persistir evento con panel | Mismo JSON que `GET /api/alarmas/eventos/:id` |
| `panel:heartbeat` | Tras heartbeat | `{ idPanel, ultimoHeartbeat }` |
| `panel:estado` | Cada ~5 min si cambió | `{ idPanel, online }` |

---

## Webhooks salientes (Next → suscriptores)

POST a cada URL de `WEBHOOK_SUBSCRIBERS`. Firma HMAC-SHA256 de `JSON.stringify` con orden fijo: `event`, `timestamp`, `tenantId`, `entityId`, `data`.

```json
{
  "event": "vehiculo.created",
  "timestamp": "2026-08-18T22:00:00.000Z",
  "tenantId": 13,
  "entityId": 1000001,
  "data": {},
  "signature": "hex..."
}
```

Eventos: `vehiculo.created` \| `vehiculo.updated` \| `vehiculo.deleted` \| `cliente.created` \| `cliente.updated`.

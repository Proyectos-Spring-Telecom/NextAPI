# Contrato webhook NextAPI → ShiftControl

Documento para que **ShiftControl** verifique alineación con el emisor de NextAPI (`WebhookEmitterModule`).

Fuente de código:

- `src/webhook-emitter/webhook-emitter.service.ts`
- `src/webhook-emitter/interfaces/webhook-event.interface.ts`
- Emisores: `src/productos/vehiculos/vehiculos.service.ts`, `src/clientes/clientes.service.ts`

---

## 1. Resumen

| Tema | Valor |
|------|--------|
| Dirección | **Saliente** desde Next hacia URLs suscritas (Next no recibe webhooks de Shift) |
| Método | `POST` |
| Content-Type | `application/json` |
| Timeout emisor | 5 s |
| Auth | Firma HMAC-SHA256 en el body (`signature`), **no** header JWT |
| Secreto compartido | Variable de entorno `WEBHOOK_SECRET` (mismo valor en Next y Shift) |
| Destinos | `WEBHOOK_SUBSCRIBERS` en Next: URLs separadas por coma |

Si `WEBHOOK_SUBSCRIBERS` está vacío o falta `WEBHOOK_SECRET`, Next **no envía** nada.

---

## 2. Envelope (cuerpo HTTP)

Orden de claves del objeto **sin** `signature` (el que se firma):

1. `event`
2. `timestamp`
3. `tenantId`
4. `entityId`
5. `data`

El body completo que recibe Shift incluye `signature` al final:

```json
{
  "event": "vehiculo.created",
  "timestamp": "2026-08-21T15:30:00.123Z",
  "tenantId": 13,
  "entityId": 1000016,
  "data": {
    "placa": "ABC1234",
    "marcaNombre": "Toyota",
    "modeloNombre": "Hilux",
    "fotoFrente": "https://bucket.s3.amazonaws.com/vehiculos/frente.jpg"
  },
  "signature": "a1b2c3…hex…"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event` | string | Nombre del evento (ver §3) |
| `timestamp` | string | ISO-8601 UTC (`new Date().toISOString()`) |
| `tenantId` | number | Cliente/tenant. En vehículo = `idCliente`. En cliente = `id` del cliente |
| `entityId` | number | Id de la entidad. Vehículo = `IdProducto`. Cliente = `Id` del cliente |
| `data` | object | Payload de negocio (ver §4); puede variar por evento |
| `signature` | string | Hex HMAC-SHA256 del JSON **sin** esta propiedad |

---

## 3. Eventos emitidos hoy

| `event` | Cuándo emite Next | `tenantId` | `entityId` |
|---------|-------------------|------------|------------|
| `vehiculo.created` | `POST /api/productos/vehiculos` exitoso | `idCliente` | `idProducto` |
| `vehiculo.updated` | `PATCH /api/productos/vehiculos/:id` exitoso | `idCliente` | `idProducto` |
| `vehiculo.deleted` | `PATCH /api/productos/vehiculos/estatus/:id` con estatus **0, 3, 4 o 5** | `idCliente` | `idProducto` |
| `cliente.created` | `POST /api/clientes` exitoso | `id` del cliente | mismo `id` |
| `cliente.updated` | `PATCH /api/clientes/:id` exitoso | `id` del cliente | mismo `id` |

### Notas de `vehiculo.deleted`

- No hay DELETE HTTP de vehículo.
- Se emite en baja lógica cuando el producto pasa a: **INACTIVO (0)**, **BAJA_REMPLAZO (3)**, **BAJA_MANTENIMIENTO (4)** o **INSERVIBLE (5)**.
- **No** se emite si el estatus queda en **1 (ACTIVO)** o **2 (ASIGNADO)**.
- Si el vehículo está en ASIGNADO (2), el PATCH de estatus se rechaza antes y **no hay webhook**.

### No emitidos aún

Operador, licencia, instalación u otros: **no** hay eventos en el emisor actual.

---

## 4. Forma de `data` por evento

### Vehículo (`vehiculo.created` | `vehiculo.updated` | `vehiculo.deleted`)

Orden de claves en `data`:

```json
{
  "placa": "ABC1234",
  "marcaNombre": "Toyota",
  "modeloNombre": "Hilux",
  "fotoFrente": "https://bucket.s3.amazonaws.com/vehiculos/foto-frente.jpg"
}
```

| Campo | Tipo | Notas |
|-------|------|--------|
| `placa` | string | Placa del vehículo |
| `marcaNombre` | string | Nombre de catálogo de marca; `""` si no hay marca |
| `modeloNombre` | string | Nombre de catálogo de modelo; `""` si no hay modelo |
| `fotoFrente` | string \| null | URL de la foto frontal en S3; `null` si no hay archivo |

No se envían el resto de fotos, VIN, eco, color, estatus, etc.

### Cliente (`cliente.created` | `cliente.updated`)

```json
{
  "idPadre": 1
}
```

| Campo | Tipo | Notas |
|-------|------|--------|
| `idPadre` | number \| null | Padre jerárquico del cliente |

---

## 5. Verificación HMAC (ShiftControl)

El emisor firma así (Node):

```ts
createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(unsignedPayload))
  .digest('hex');
```

donde `unsignedPayload` es el objeto con **exactamente** estas claves y este orden:

```ts
{
  event,
  timestamp,
  tenantId,
  entityId,
  data,
}
```

### Checklist de verificación en Shift

1. Parsear el JSON del body.
2. Separar `signature` del resto.
3. Reconstruir el objeto unsigned con el **mismo orden de claves** (`event` → `timestamp` → `tenantId` → `entityId` → `data`).
4. Dentro de `data`, conservar el orden de propiedades recibido (vehículo: `placa`, `marcaNombre`, `modeloNombre`, `fotoFrente`; cliente: `idPadre`).
5. Calcular `HMAC-SHA256(secret, JSON.stringify(unsigned))` en hex (minúsculas, como Node `digest('hex')`).
6. Comparar en tiempo constante con `signature`.
7. Si no coincide → rechazar (401/403) y no aplicar cambios.

### Ejemplo Pseudocódigo (Shift)

```text
body = JSON.parse(request.body)
sig = body.signature
unsigned = {
  event: body.event,
  timestamp: body.timestamp,
  tenantId: body.tenantId,
  entityId: body.entityId,
  data: body.data
}
expected = hmac_sha256_hex(WEBHOOK_SECRET, json_stringify(unsigned))
if expected != sig → reject
else → procesar event
```

**Importante:** `JSON.stringify` debe serializar números como números (no strings) y no reordenar claves. Si el stack de Shift reordena propiedades al parsear, hay que rearmar el objeto en el orden fijo antes de firmar.

---

## 6. Ejemplos completos

### `vehiculo.created`

```json
{
  "event": "vehiculo.created",
  "timestamp": "2026-08-21T15:30:00.123Z",
  "tenantId": 13,
  "entityId": 1000042,
  "data": {
    "placa": "XYZ9876",
    "marcaNombre": "Nissan",
    "modeloNombre": "NP300",
    "fotoFrente": "https://bucket.s3.amazonaws.com/vehiculos/frente.jpg"
  },
  "signature": "<hmac-hex>"
}
```

### `vehiculo.deleted` (tras PATCH estatus a 0/3/4/5)

```json
{
  "event": "vehiculo.deleted",
  "timestamp": "2026-08-21T16:00:00.000Z",
  "tenantId": 13,
  "entityId": 1000042,
  "data": {
    "placa": "XYZ9876",
    "marcaNombre": "Nissan",
    "modeloNombre": "NP300",
    "fotoFrente": "https://bucket.s3.amazonaws.com/vehiculos/frente.jpg"
  },
  "signature": "<hmac-hex>"
}
```

### `cliente.created`

```json
{
  "event": "cliente.created",
  "timestamp": "2026-08-21T15:45:00.000Z",
  "tenantId": 50,
  "entityId": 50,
  "data": {
    "idPadre": 1
  },
  "signature": "<hmac-hex>"
}
```

---

## 7. Configuración Next (referencia)

```env
WEBHOOK_SECRET=<mismo secreto que ShiftControl>
WEBHOOK_SUBSCRIBERS=https://shift.ejemplo.com/webhooks/next,https://otro.ejemplo.com/hook
```

- Varias URLs: separadas por coma; Next hace un `POST` a cada una.
- Fallo de entrega: Next solo loguea / bitácora; **no reintenta** automáticamente.

---

## 8. Checklist de alineación ShiftControl

- [ ] Endpoint `POST` acepta JSON con envelope §2.
- [ ] Valida HMAC con `WEBHOOK_SECRET` según §5 (orden de claves).
- [ ] Reconoce los 5 eventos de §3.
- [ ] Para vehículo usa `entityId` = id de producto/vehículo y `data.placa` / `data.marcaNombre` / `data.modeloNombre` / `data.fotoFrente`.
- [ ] Para cliente usa `tenantId` = `entityId` = id cliente y `data.idPadre`.
- [ ] Trata `vehiculo.deleted` como baja lógica (no borrado físico obligatorio en Next).
- [ ] No espera campos extra (otras fotos, estatus, RFC, etc.) salvo los documentados en §4.
- [ ] Responde 2xx en tiempo razonable (&lt; 5 s) para evitar timeout del emisor.
---

## 9. Fuera de alcance de este contrato

- Ingest de alarmas SIA (`/api/alarmas/ingest*`) usa **otro** secreto (`GATEWAY_HMAC_SECRET`) y otro protocolo (headers). No confundir con este webhook.
- REST JWT de Next hacia Shift (consultas): distinto de este canal push.

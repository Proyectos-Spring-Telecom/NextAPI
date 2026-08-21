# Consumo: vehículo por placa (productivo)

Prompt / guía para integrar `GET /api/productos/vehiculos/placa/:placa` contra NextAPI en producción.

## Endpoint

| Campo | Valor |
|-------|--------|
| Método | `GET` |
| URL productiva | `https://springtelecom.mx/nextAPI/api/productos/vehiculos/placa/{placa}` |
| Auth | JWT Bearer (access token de `POST .../api/login`) |
| Content-Type | no aplica (sin body) |

La placa va en la URL. Si contiene caracteres especiales, usar `encodeURIComponent(placa)`.

## Prerrequisito: login

```http
POST https://springtelecom.mx/nextAPI/api/login
Content-Type: application/json

{
  "userName": "<usuario>",
  "password": "<contraseña>"
}
```

Del JSON de respuesta tomar el **access token** (campo según contrato de login del front; normalmente `accessToken` o análogo dentro de `data`).

Usar en las siguientes llamadas:

```http
Authorization: Bearer <accessToken>
```

## Llamada por placa

```http
GET https://springtelecom.mx/nextAPI/api/productos/vehiculos/placa/A-06104-E
Authorization: Bearer <accessToken>
```

### cURL

```bash
TOKEN="<accessToken>"
PLACA="A-06104-E"

curl -sS -X GET \
  "https://springtelecom.mx/nextAPI/api/productos/vehiculos/placa/$(python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PLACA")" \
  -H "Authorization: Bearer $TOKEN"
```

### JavaScript (fetch)

```js
const base = 'https://springtelecom.mx/nextAPI';
const accessToken = '<accessToken>';
const placa = 'A-06104-E';

const res = await fetch(
  `${base}/api/productos/vehiculos/placa/${encodeURIComponent(placa)}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
);

if (!res.ok) {
  const text = await res.text(); // errores suelen ser texto plano
  throw new Error(`HTTP ${res.status}: ${text}`);
}

const { data } = await res.json();
// data.numeroEconomico, data.fotoFrente, data.marcaNombre, ...
```

## Respuesta 200 (campos reales)

```json
{
  "data": {
    "id": 1,
    "placa": "A-06104-E",
    "numeroEconomico": "1",
    "anio": 2019,
    "color": "Rojo",
    "fotoFrente": null,
    "km": null,
    "capacidadLitros": null,
    "estatus": 1,
    "fechaCreacion": "2026-04-13T20:26:00.000Z",
    "idCliente": 11,
    "nombreCompleto": "transporterapido",
    "modeloId": 16,
    "modeloNombre": "Virtus",
    "marcaId": 3,
    "marcaNombre": "Volkswagen",
    "combustibleId": null,
    "combustibleNombre": null
  }
}
```

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | number | `IdProducto` |
| `placa` | string | |
| `numeroEconomico` | string \| null | Número económico |
| `anio` | number \| null | |
| `color` | string \| null | |
| `fotoFrente` | string \| null | URL S3 o `null` |
| `km` | number \| null | |
| `capacidadLitros` | number \| null | |
| `estatus` | number | Del producto; este endpoint solo trae activos (`1`) |
| `fechaCreacion` | string (ISO) | Del producto |
| `idCliente` | number | Tenant dueño |
| `nombreCompleto` | string \| null | Cliente |
| `modeloId` / `modeloNombre` | number/string \| null | Catálogo |
| `marcaId` / `marcaNombre` | number/string \| null | Catálogo |
| `combustibleId` / `combustibleNombre` | number/string \| null | Catálogo |

**No** se devuelven hoy: `tipoVehiculoId` / `tipoVehiculoNombre` (no hay columna/catálogo de tipo de vehículo en Next).

## Errores

| HTTP | Cuerpo | Cuándo |
|------|--------|--------|
| 401 | texto | Sin token o token inválido |
| 400 | texto | Placa vacía, o varias placas iguales en el ámbito del rol |
| 404 | texto | No hay vehículo activo con esa placa en el tenant permitido |

## Reglas de negocio a tener en cuenta

1. Solo vehículos con producto **activo** (`estatus = 1`).
2. Alcance por rol del JWT (global / jerarquía / solo cliente).
3. JSON camelCase; IDs numéricos.
4. Prefijo global `/api` bajo la base `https://springtelecom.mx/nextAPI`.

## Prompt corto para otro agente / integrador

```text
Consume NextAPI productivo:
Base: https://springtelecom.mx/nextAPI
1) POST /api/login con userName y password → obtener accessToken JWT.
2) GET /api/productos/vehiculos/placa/{placa} con header Authorization: Bearer {accessToken}.
3) Encode la placa en la URL. Esperar { data: { id, placa, numeroEconomico, anio, color, fotoFrente, km, capacidadLitros, estatus, fechaCreacion, idCliente, nombreCompleto, modeloId, modeloNombre, marcaId, marcaNombre, combustibleId, combustibleNombre } }.
4) Manejar 401/400/404 como texto plano. No asumir tipoVehiculoId.
```

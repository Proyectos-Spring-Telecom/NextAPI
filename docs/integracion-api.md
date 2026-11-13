# Integración con Next: llave de API y webhooks

Contrato técnico para el sistema de un cliente que se conecta con Next (por ejemplo, la Torre de Control de Fis Fiber). Spring Telecom entrega la llave de API y, si se pide, la suscripción de webhooks.

**Base:** `https://springtelecom.mx/nextAPI/api`
**Documentación interactiva:** Swagger de Next, etiqueta **Reportes** (botón *Authorize* → `api-key`).

---

## 1. Llave de API (consultas)

Cada petición lleva la llave en el encabezado:

```
X-Api-Key: nxt_3fa9c210_Qm9…
Content-Type: application/json
```

- **Quién la emite:** Spring Telecom, por cliente. Se entrega una sola vez y Next solo guarda su huella, así que si se pierde se emite otra.
- **Alcance:** las unidades del cliente y de sus subclientes, igual que un usuario Cliente de la plataforma.
- **Solo lectura:** con la llave únicamente se consultan reportes. Cualquier otra ruta responde `401`.
- **Vigencia:** puede tener fecha de vencimiento. Revocada, deja de servir en a lo más 1 minuto.
- **Errores:** `401` si la llave es inválida, está vencida o revocada, o si la ruta no la acepta; `403` si se pide un cliente fuera de su alcance.

### Rutas disponibles

Todas son `POST` con cuerpo JSON. El filtro común es `{ "filtro": "placa" | "economico" | "imei" | "numeroSerie", "valores": [...] }`; sin él, cubre toda la flota.

| Ruta | Qué devuelve |
|---|---|
| `/reportes/ultima-posicion` | Última posición de cada unidad. |
| `/reportes/posiciones` | Posiciones de un periodo. |
| `/reportes/distancia` | Km recorridos (acepta `incluirJornada`). |
| `/reportes/velocidad` | Posiciones sobre una velocidad (acepta `incluirJornada`). |
| `/reportes/flota-dia` | Una fila por unidad y día: primer encendido, último apagado, horas de motor, km y tiempos. |
| `/reportes/jornada` | Línea de tiempo del día, ciclos de motor, cambios de estado y eventos. |
| `/reportes/motor` | Ciclos de encendido y apagado, y horas de motor. |
| `/reportes/paradas` | Paradas con duración, motor, coordenada, geocerca y punto de interés. |
| `/reportes/geocercas/eventos` | Entradas y salidas de geocerca, con el tiempo dentro. |
| `/reportes/salidas-geocerca` | Salidas de geocerca reconstruidas del historial. |
| `/reportes/paso-por-poi` | Unidades que pasaron por puntos de interés. |
| `/reportes/contadores` | Odómetro y horas de motor acumulados. |
| `/reportes/odometro` | Km y horas de motor por día, con el acumulado al cierre. |

**Fechas:** todas las fechas van en hora del centro de México, sin zona (`2026-11-12T15:31:09`). Los días van de 00:00 a 23:59.

**Ejemplo:**

```bash
curl -s https://springtelecom.mx/nextAPI/api/reportes/flota-dia \
  -H 'X-Api-Key: nxt_3fa9c210_Qm9…' -H 'Content-Type: application/json' \
  -d '{ "fechaInicio": "2026-11-12" }'
```

---

## 2. Webhooks (avisos de Next al sistema del cliente)

Next manda un `POST` JSON a la URL del cliente cada vez que ocurre un evento suscrito.

- **La URL** debe ser `https` y estar en un servidor público.
- **Una suscripción** recibe los eventos del cliente y de sus subclientes.

### Eventos

| Evento | Cuándo | `data` |
|---|---|---|
| `alerta.abierta` | Next abre un incidente automático (pánico, colisión, batería, energía, geocerca, etc.). | `idIncidente`, `descripcion`, `imei`, `estado`, `idEvento`, `fechaHora`, `lat`, `lng` (null si llegó sin ubicación). |
| `geocerca.entrada` / `geocerca.salida` | Una unidad entra o sale de una geocerca ligada. | `idGeocerca`, `nombreGeocerca`, `idProducto`, `idInstalacion`, `idPosicion`, `fechaHora`, `lat`, `lng`. |
| `jornada.cerrada` | Poco después de medianoche, una por unidad que reportó el día anterior. | El resumen de `flota-dia`, más `idInstalacion` e `idProducto`. |
| `prueba` | Lo dispara Spring Telecom para validar la conexión. | `mensaje`. |

### Formato

```
POST <url del cliente>
Content-Type: application/json
X-Next-Evento: geocerca.salida
X-Next-Envio: 1842
X-Next-Timestamp: 1794605589
X-Next-Firma: sha256=5d1e…
```

```json
{ "evento": "geocerca.salida", "fecha": "2026-11-13T15:33:09", "idCliente": 15, "data": { "idGeocerca": 12, "nombreGeocerca": "Base Querétaro", "...": "..." } }
```

### Verificar la firma

`X-Next-Firma` = `sha256=` + HMAC-SHA256 en hexadecimal, con el **secreto de la suscripción**, del texto `<X-Next-Timestamp>.<cuerpo crudo>`.

Recomendaciones:
- Verificar la firma con el cuerpo **crudo**, antes de parsear el JSON.
- Rechazar timestamps con más de 5 minutos de diferencia.
- Descartar un `X-Next-Envio` repetido: un reintento puede llegar dos veces.

```js
// Node.js (Express con express.raw({ type: 'application/json' }))
const crypto = require('crypto');
function firmaValida(req, secreto) {
  const ts = req.get('X-Next-Timestamp');
  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto).update(`${ts}.${req.body}`).digest('hex');
  const recibida = req.get('X-Next-Firma') || '';
  return Math.abs(Date.now() / 1000 - Number(ts)) < 300 &&
    recibida.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
}
```

```python
# Python
import hmac, hashlib, time
def firma_valida(cuerpo_crudo: bytes, ts: str, firma: str, secreto: str) -> bool:
    esperada = 'sha256=' + hmac.new(secreto.encode(), f'{ts}.'.encode() + cuerpo_crudo, hashlib.sha256).hexdigest()
    return abs(time.time() - int(ts)) < 300 and hmac.compare_digest(esperada, firma)
```

### Respuesta y reintentos

- Responder `2xx` en menos de 10 segundos. El sistema del cliente debe procesar el aviso después de responder.
- Si no hay `2xx`, Next reintenta a 1, 2, 4, 8… minutos (máximo 6 horas entre intentos) hasta 10 veces. Después lo marca como fallido.
- Next no sigue redirecciones.
- Spring Telecom ve cada envío (estatus, código HTTP y error) para dar soporte.

---

## 3. Para Spring Telecom (administración)

Roles SA, Dev y Admin; todo queda en bitácora.

| Acción | Ruta |
|---|---|
| Crear llave | `POST /llaves-api` `{ idCliente, nombre, expiraEn? }` → devuelve `llave` una sola vez. |
| Listar o revocar llaves | `GET /llaves-api?idCliente=` · `PATCH /llaves-api/:id/revocar` |
| Crear webhook | `POST /webhooks-cliente` `{ idCliente, nombre, url, eventos[] }` → devuelve `secreto` una sola vez. |
| Probar webhook | `POST /webhooks-cliente/:id/prueba`, y luego `GET /webhooks-cliente/:id/envios` para ver el resultado. |
| Listar o revocar webhooks | `GET /webhooks-cliente?idCliente=` · `PATCH /webhooks-cliente/:id/revocar` |

**Variables:** `WEBHOOKS_CLIENTE_ENABLED=false` detiene el despachador; los envíos quedan pendientes. Los webhooks de ShiftControl (`WEBHOOK_SUBSCRIBERS`) no cambian.

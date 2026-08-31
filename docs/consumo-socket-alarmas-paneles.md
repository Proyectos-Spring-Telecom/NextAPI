# Consumo Socket.IO — Paneles de alarma (`/alarmas`)

Guía para conectar un front o backend consumidor al namespace Socket.IO de **NextAPI** y recibir eventos en tiempo real de paneles AX PRO (eventos SIA, heartbeat y estado online/offline).

---

## 1. Resumen

| Concepto | Valor |
|----------|--------|
| Protocolo | **Socket.IO v4** |
| Namespace | **`/alarmas`** (no usar el namespace raíz `/`) |
| Auth | **JWT access token** (mismo que REST) |
| Rooms internas | `panel:{idDispositivo}` — el servidor asigna al conectar |
| REST complementario | `GET /api/alarmas/*` |

El socket **no reemplaza** el REST inicial: conviene cargar paneles y últimos eventos por HTTP y usar el socket solo para **push**.

---

## 2. URLs de conexión

| Entorno | URL base Socket.IO | Namespace |
|---------|-------------------|-----------|
| Local | `http://localhost:3004` | `/alarmas` |
| Producción | `https://springtelecom.mx/nextAPI` | `/alarmas` |

> El prefijo `/api` aplica a REST, **no** al namespace de Socket.IO. La URL efectiva es `{BASE}/alarmas`.

El proxy inverso (nginx, etc.) debe permitir **upgrade WebSocket** hacia el puerto de NextAPI.

---

## 3. Autenticación

Obtén el access token con login:

```http
POST https://springtelecom.mx/nextAPI/api/login?Nombres=NXT
Content-Type: application/json

{ "userName": "...", "password": "..." }
```

Respuesta: `{ "token": "<JWT>", "refreshToken": "..." }`.

El token debe ser de tipo **`access`** (`payload.type === 'access'`). Si expira, renueva con `POST /api/login/refresh`.

### Formas de enviar el token al conectar

El gateway acepta (en orden de búsqueda):

1. `handshake.auth.token`
2. Header `Authorization: Bearer <token>`
3. Query `?token=<token>`

**Recomendado:** `auth.token` (cliente Socket.IO).

---

## 4. Alcance por rol (paneles visibles)

Al conectar, el servidor:

1. Valida el JWT.
2. Resuelve clientes permitidos según rol (`TenantFilterService`).
3. Une el socket a `panel:{idDispositivo}` de cada `PanelAlarma` activo (`Estatus = 1`) visible.
4. Emite **`conexion:lista`** con los IDs suscritos.

| Rol | Paneles visibles |
|-----|------------------|
| 1, 2, 3, 4, 5, 8 | Todos los paneles activos |
| 6 | Paneles de su `idCliente` + clientes hijos |
| 7 (y otros) | Solo paneles de su `idCliente` |

`idDispositivo` del panel = `PanelAlarma.IdDispositivo` = `id` en REST `/api/alarmas/paneles/:id`.

---

## 5. Eventos del servidor → cliente

### 5.1 `conexion:lista` (al conectar)

Confirma suscripción exitosa.

```json
{
  "idsPaneles": [1000001, 1000002]
}
```

### 5.2 `evento:nuevo`

Nuevo evento SIA persistido (no RP/heartbeat). Misma forma que `GET /api/alarmas/eventos/:id`.

```json
{
  "id": 42,
  "idPanel": 1000001,
  "idCliente": 1,
  "codigoSia": "PA",
  "tipoEvento": "panico",
  "tipoEventoEtiqueta": "Pánico",
  "zona": 2,
  "codigoUsuario": null,
  "nombreDispositivo": "Cocina",
  "severidad": 3,
  "recibidoEn": "2026-08-28T18:53:13.000Z",
  "esRestauracion": false,
  "panel": {
    "id": 1000001,
    "cuentaSia": "1001",
    "nombre": "Panel principal",
    "inmueble": {
      "id": 1000015,
      "inmueble": "Bodega norte",
      "lat": 19.4326,
      "lng": -99.1332
    }
  }
}
```

Solo se emite si el panel existe en BD (`idPanel` not null). Eventos huérfanos no generan push.

### 5.3 `panel:heartbeat`

Tras actualizar `PanelAlarma.UltimoHeartbeat` (código SIA RP vía RabbitMQ o ingest HTTP).

```json
{
  "idPanel": 1000001,
  "ultimoHeartbeat": "2026-08-28T18:53:13.000Z"
}
```

No inserta fila en `EventoAlarma`.

### 5.4 `panel:estado`

Cambio online/offline detectado por el scheduler (cada **5 min**), según `SIA_OFFLINE_THRESHOLD_MS` (default **600000** ms = 10 min sin heartbeat).

```json
{
  "idPanel": 1000001,
  "online": false
}
```

---

## 6. Ejemplo — JavaScript (socket.io-client)

```bash
npm install socket.io-client
```

```typescript
import { io, Socket } from 'socket.io-client';

const API_BASE = 'https://springtelecom.mx/nextAPI';
let accessToken = '...'; // de POST /api/login

const socket: Socket = io(`${API_BASE}/alarmas`, {
  transports: ['websocket'],
  auth: { token: accessToken },
});

socket.on('connect', () => {
  console.log('Socket conectado', socket.id);
});

socket.on('conexion:lista', ({ idsPaneles }) => {
  console.log('Paneles suscritos:', idsPaneles);
});

socket.on('evento:nuevo', (evento) => {
  console.log('Evento SIA:', evento.codigoSia, evento.tipoEventoEtiqueta, evento);
  // Actualizar UI / lista de eventos del panel evento.idPanel
});

socket.on('panel:heartbeat', ({ idPanel, ultimoHeartbeat }) => {
  console.log('Heartbeat panel', idPanel, ultimoHeartbeat);
  // Actualizar ultimoHeartbeat y online=true en UI del panel
});

socket.on('panel:estado', ({ idPanel, online }) => {
  console.log('Estado panel', idPanel, online ? 'ONLINE' : 'OFFLINE');
});

socket.on('connect_error', (err) => {
  console.error('Error de conexión:', err.message);
  // Token expirado → refresh + reconectar
});

socket.on('disconnect', (reason) => {
  console.warn('Desconectado:', reason);
});
```

---

> **Guía Angular completa:** [consumo-socket-alarmas-angular.md](./consumo-socket-alarmas-angular.md) (servicio, dashboard, reconexión, checklist prod).

## 7. Ejemplo — Angular (servicio)

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AlarmasSocketService implements OnDestroy {
  private socket?: Socket;
  readonly eventoNuevo$ = new Subject<any>();
  readonly heartbeat$ = new Subject<{ idPanel: number; ultimoHeartbeat: string }>();
  readonly estado$ = new Subject<{ idPanel: number; online: boolean }>();

  connect(apiBase: string, accessToken: string) {
    this.socket?.disconnect();
    this.socket = io(`${apiBase}/alarmas`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });
    this.socket.on('evento:nuevo', (e) => this.eventoNuevo$.next(e));
    this.socket.on('panel:heartbeat', (h) => this.heartbeat$.next(h));
    this.socket.on('panel:estado', (s) => this.estado$.next(s));
  }

  disconnect() {
    this.socket?.disconnect();
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
```

Usa un `HttpInterceptor` para el Bearer en REST y pasa el mismo token al servicio socket tras el login.

---

## 8. Flujo recomendado en el front

```text
1. POST /api/login → token
2. GET /api/alarmas/paneles        → estado inicial (online, ultimoHeartbeat, inmueble)
3. GET /api/alarmas/ultimos-eventos → último evento por panel
4. Conectar socket /alarmas con auth.token
5. Escuchar conexion:lista → validar idsPaneles
6. En evento:nuevo      → prepend en lista / notificación
7. En panel:heartbeat   → actualizar ultimoHeartbeat, marcar online
8. En panel:estado      → actualizar badge online/offline
9. Antes de expirar JWT → POST /api/login/refresh → socket.io auth update o reconectar
```

---

## 9. REST relacionado

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/alarmas/paneles` | Lista paneles activos + inmueble + `online` |
| GET | `/api/alarmas/paneles/:id` | Detalle panel (`id` = IdDispositivo) |
| GET | `/api/alarmas/ultimos-eventos` | Snapshot último evento por panel |
| GET | `/api/alarmas/eventos` | Historial paginado/filtrado |
| GET | `/api/alarmas/eventos/:id` | Detalle (misma forma que `evento:nuevo`) |

Headers REST: `Authorization: Bearer <token>`.

---

## 10. Errores frecuentes

| Síntoma | Causa probable |
|---------|----------------|
| Conexión rechazada al instante | Token ausente, expirado o `type !== 'access'` |
| `conexion:lista` con `idsPaneles: []` | Rol sin paneles en alcance o ningún panel activo |
| No llegan eventos | Conectado al namespace `/` en lugar de `/alarmas` |
| Eventos duplicados | Reconexión sin deduplicar por `evento.id` |
| `online` desfasado | Confiar en `panel:estado`; el heartbeat solo actualiza timestamp |

---

## 11. Origen de los eventos en tiempo real

```text
SpringTrackCam (gateway)
  → RabbitMQ (axpro.event / axpro.heartbeat)
  → NextAPI AlarmasIngestService
  → MySQL + AlarmasGateway.emit*
  → Socket.IO /alarmas → rooms panel:{id}
```

También puede llegar ingest HTTP (`POST /api/alarmas/ingest*`) durante migración; el socket se comporta igual.

---

## 12. Checklist integración

- [ ] Login y token `access` válido
- [ ] Conexión a `{BASE}/alarmas` con `auth.token`
- [ ] Recibir `conexion:lista` con paneles esperados
- [ ] Handler `evento:nuevo` actualiza UI
- [ ] Handler `panel:heartbeat` actualiza timestamp
- [ ] Handler `panel:estado` actualiza online/offline
- [ ] Refresh token + reconexión antes de expiración
- [ ] Carga inicial vía REST (`/paneles`, `/ultimos-eventos`)

---

*Referencia de implementación: `src/alarmas/alarmas.gateway.ts`, `src/alarmas/alarmas-ingest.service.ts`, `src/alarmas/panel-online.scheduler.ts`.*

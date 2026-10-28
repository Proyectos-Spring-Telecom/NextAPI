# Órdenes de servicio e instalaciones — especificación de cambios en NextAPI

**Rama:** `dev-isra` (commits `e396fb6`, `e0d06ec`). **Desplegado** en springfieldDev el 27/10/2026.
**DDL:** `deploy/sql/OrdenesServicio.sql`. **Contrato resumido:** [contratos.md §14.1](contratos.md).
**Código:** `src/ordenes-servicio/` y `src/instalaciones/instalaciones.service.ts`.

## 1. Objetivo

Registrar la evidencia de cada visita del técnico, tanto del primer servicio (alta del equipo en la unidad) como de los mantenimientos posteriores. Cada orden queda ligada al módulo de Instalaciones, y al cerrarla se aplica el movimiento correspondiente (alta, cambio de equipo o SIM, baja), todo en una sola transacción.

Esta especificación cubre **solo el API**. La app Flutter (pantallas "Tipo de servicio" y "Pruebas generadas") la consume, pero no forma parte de este cambio.

## 2. Reglas de negocio

| # | Regla |
|---|-------|
| 1 | **El cliente se da de alta en la oficina antes de que el técnico salga a campo.** La orden no crea clientes: si no existe o no está activo, responde 400. |
| 2 | **El vehículo se puede dar de alta en la oficina o en campo.** En campo, la app lo busca con `GET /productos/vehiculos/placa/:placa` y, si no existe, lo crea con `POST /productos/vehiculos`, que devuelve `data.id` = `idProducto`. La orden lo referencia por `idProducto`. |
| 3 | **Una orden es de un solo tipo de servicio:** `instalacion` (alta), `revision`, `c_sim`, `c_equipo` o `desinstalacion`. El tipo no se puede cambiar. |
| 4 | **Guardado parcial.** La orden nace en `borrador`, se va llenando por secciones (`PATCH` y archivos) y se cierra al final. El folio `OS-000001` lo asigna el servidor. |
| 5 | **Idempotencia.** La app genera `claveApp` (UUID) al empezar. Si reenvía el alta con la misma clave, recibe la orden existente; si se repite el cierre, recibe el mismo resultado. |
| 6 | **El técnico es el usuario del token**, no se envía en el cuerpo. El monitorista se elige: usuario activo con rol 4 o 5. |
| 7 | **Cada casilla se responde sí o no.** Se guardan también las que quedan en no, para distinguir "no tiene / no pasó" de "no se revisó". |
| 8 | **El catálogo está en BD.** Agregar una casilla, una foto o volver una foto obligatoria se hace con un `INSERT`/`UPDATE` en `CatOrdenServicioOpciones`, sin publicar otra versión de la app. |

## 3. Roles

| Acción | Roles |
|--------|-------|
| Crear, guardar, subir archivos, cerrar, cancelar | 1 SA, 2 DEV, 3 ADMIN, 8 TÉCNICO |
| Consultar (detalle, listado, catálogo) | Los anteriores, más 4 JEFE_MONITOREO y 5 MONITOREO |

El técnico (rol 8) solo ve y edita **sus** órdenes; las ajenas le responden 404. Los roles 1–3 editan todas. Los roles 4 y 5 ven todas, pero no editan.

## 4. Modelo de datos (MySQL `Next`)

Sin migraciones de TypeORM: el DDL se aplica a mano con `deploy/sql/OrdenesServicio.sql` (idempotente: `CREATE TABLE IF NOT EXISTS` / `INSERT IGNORE`).

### 4.1 `OrdenesServicio`

| Columna | Tipo | Notas |
|---------|------|-------|
| `Id` | BIGINT PK | |
| `Folio` | VARCHAR(20) UQ | `OS-000001` |
| `ClaveApp` | CHAR(36) UQ | UUID de la app (idempotencia) |
| `TipoServicio` | VARCHAR(20) | `instalacion` \| `revision` \| `c_sim` \| `c_equipo` \| `desinstalacion` |
| `Estatus` | VARCHAR(12) | `borrador` \| `cerrada` \| `cancelada` |
| `IdCliente` | BIGINT FK → `Clientes` | |
| `IdInstalacion` | BIGINT | Instalación atendida (NULL en un alta hasta cerrar) |
| `IdInstalacionResultado` | BIGINT | Instalación vigente después del cierre |
| `IdHistoricoInstalacion` | BIGINT | Versión archivada por un cambio de equipo o SIM |
| `IdProducto` | BIGINT | Vehículo/activo; se mantiene igual entre versiones de la instalación |
| `IdDispositivoNuevo` / `IdSimNuevo` | BIGINT | Equipo o SIM que entra |
| `EstatusSalienteAnterior` | TINYINT | Cambio: estatus que recibe el equipo o SIM que sale (0–5) |
| `EstatusInstalacionBaja` | TINYINT | Desinstalación: 0 inactiva, 5 inservible |
| `IdTecnico` | BIGINT | Usuario del token |
| `IdMonitorista` | BIGINT | Rol 4/5 |
| `FechaCaptura` | DATETIME | Reloj del celular, guardado en hora de Ciudad de México |
| `Lat` / `Lng` | DOUBLE | GPS del celular (NULL sin permiso) |
| `Observaciones` | TEXT | |
| `FechaCreacion` / `FechaActualizacion` / `FechaCierre` / `IdUsuarioCierre` | | |

Índices: (`IdCliente`, `FechaCreacion`), `IdInstalacion`, `IdInstalacionResultado`, `IdProducto`, (`IdTecnico`, `Estatus`).

**No hay FK a `Instalaciones` a propósito:** el `PATCH /instalaciones` borra la fila anterior y crea otra con Id nuevo. Por eso la orden guarda los dos Id (atendida y resultante).

### 4.2 `OrdenServicioRespuestas`
PK (`IdOrdenServicio`, `Seccion`, `Clave`), `Valor` TINYINT (1 = sí/correcto, 0 = no). `ON DELETE CASCADE`.

### 4.3 `OrdenServicioArchivos`
`Id`, `IdOrdenServicio`, `Clave`, `Ruta` (URL privada de S3), `FechaCreacion`. UQ (`IdOrdenServicio`, `Clave`): si se sube otra vez la misma clave, se reemplaza el archivo. `ON DELETE CASCADE`.

### 4.4 `CatOrdenServicioOpciones` (catálogo inicial: 24 opciones)

| Sección | Claves | Obligatorio |
|---------|--------|-------------|
| `vehiculo_cuenta_con` | `boton_panico`, `inmovilizador`, `regulador`, `estereo`, `alarma` | (responder todas) |
| `funcionamiento_vehiculo` | `tablero_iniciar`, `tablero_final`, `unidad_iniciar`, `unidad_final` | (responder todas) |
| `fallas_equipo` | `mojado`, `golpeado`, `cables_cortados`, `cables_desconectados`, `otro` | (responder todas) |
| `pruebas` | `transmision`, `boton_panico`, `paro_motor` | (responder todas; al menos una correcta) |
| `fotos` | `tablero_inicio`, `tablero_final` | **Sí** |
| `fotos` | `falla_extra_1`, `falla_extra_2`, `falla_extra_3` | No |
| `firmas` | `firma_cliente`, `firma_tecnico` | **Sí** |

## 5. Endpoints (`/api/ordenes-servicio`, JWT Bearer)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/catalogo` | Opciones activas por sección, más los monitoristas |
| POST | `/` | Iniciar la orden (borrador) |
| PATCH | `/:id` | Guardado parcial |
| POST | `/:id/archivos/:clave` | Subir foto o firma (multipart `file`) |
| GET | `/:id` | Detalle con archivos firmados y `faltantesParaCerrar` |
| POST | `/:id/cerrar` | Validar y aplicar el movimiento en Instalaciones |
| POST | `/:id/cancelar` | Cancelar el borrador |
| GET | `/paginado/:page/:limit` | Listado con filtros |

### 5.1 `GET /catalogo`
```json
{ "data": [ {
  "secciones": {
    "pruebas": [ { "clave": "transmision", "nombre": "Transmisión correcta", "obligatorio": false } ],
    "fotos":   [ { "clave": "tablero_inicio", "nombre": "Tablero al iniciar", "obligatorio": true } ]
  },
  "monitoristas": [ { "id": 15, "nombre": "Ana López Ruiz" } ]
} ] }
```

### 5.2 `POST /` — iniciar
```json
{ "claveApp": "3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90", "tipoServicio": "c_equipo", "idCliente": 12, "idInstalacion": 340 }
```
- `idInstalacion` es obligatorio salvo en `instalacion`, y debe ser vigente (estatus 1) y del cliente. En un alta **no** se envía.
- En los tipos distintos de alta, `idProducto` se toma de la instalación.
- Respuesta: `{ "status": "success", "message": "Orden de servicio creada", "data": { "id": 42, "nombre": "OS-000042" } }`.
- Si se reenvía la misma `claveApp`, devuelve la misma orden con `"La orden ya existía (misma claveApp)"`. Si la clave pertenece a una orden de otro técnico, responde 409.

### 5.3 `PATCH /:id` — guardado parcial
Solo funciona en `borrador`. Se manda únicamente lo que cambió; `null` borra un valor.
```json
{
  "idDispositivoNuevo": 981, "estatusSalienteAnterior": 4, "idMonitorista": 15,
  "fechaCaptura": "2026-10-27T20:50:00-06:00", "lat": 18.9395, "lng": -99.2534,
  "observaciones": "Cable de alimentación sulfatado",
  "respuestas": [ { "seccion": "pruebas", "clave": "transmision", "valor": true },
                  { "seccion": "fallas_equipo", "clave": "otro", "valor": true } ]
}
```
- Las `respuestas` se agregan o reemplazan por (`seccion`, `clave`) y no borran las demás. Si una clave no existe en el catálogo, responde 400 y lista las claves inválidas.
- Si se manda un campo que no aplica al tipo, responde 400 (`"<campo> no aplica a una orden de tipo <tipo>"`):

| Campo | Tipos donde aplica |
|-------|--------------------|
| `idProducto` | `instalacion` |
| `idDispositivoNuevo` | `instalacion`, `c_equipo` |
| `idSimNuevo` | `instalacion`, `c_sim` |
| `estatusSalienteAnterior` | `c_equipo`, `c_sim` |
| `estatusInstalacionBaja` | `desinstalacion` |

- `idProducto` debe ser del cliente. `idMonitorista` debe ser un usuario activo con rol 4 o 5.

### 5.4 `POST /:id/archivos/:clave`
- multipart con el campo `file`. Solo PNG o JPG; WEBP y HEIC se convierten a JPG en la app. El límite es `UPLOAD_MAX_SIZE` (10 MB por defecto).
- `clave` debe ser una clave de `fotos` o `firmas` del catálogo. Si se sube otra vez la misma clave, reemplaza el archivo en S3.
- Se guarda en S3 privado, en la carpeta `ordenes-servicio/`.

### 5.5 `GET /:id`
Devuelve la orden, `respuestas` (con `valor` booleano) y `archivos` (`clave`, `fechaCreacion`, `url` firmada por 5 min). Si está en borrador, incluye además `faltantesParaCerrar: string[]` con mensajes en español listos para mostrarse en la app.

### 5.6 `POST /:id/cerrar`
Se cierra en una sola transacción, con bloqueo de la fila de la orden:
1. Valida lo que se necesita para cerrar (§6). Si falta algo, responde **400 `{ "message": "La orden está incompleta", "faltantes": [...] }`**.
2. Revalida el monitorista.
3. Aplica el movimiento en Instalaciones (§7).
4. Marca la orden como `cerrada` con `idInstalacion`, `idInstalacionResultado`, `idHistoricoInstalacion`, `fechaCierre` e `idUsuarioCierre`.

Si cualquier paso falla, no se guarda nada: no puede quedar una orden cerrada sin movimiento ni un movimiento sin orden.

Respuesta: `{ "status": "success", "message": "Orden de servicio cerrada", "data": { "id": 42, "nombre": "OS-000042", "idInstalacionResultado": 512 } }`. Si se repite sobre una orden ya cerrada, devuelve lo mismo con `"La orden ya estaba cerrada"`.

### 5.7 `POST /:id/cancelar`
Solo funciona en borrador. No toca la instalación.

### 5.8 `GET /paginado/:page/:limit`
- `limit` va de 1 a 100.
- Filtros por query:
  - `idCliente`;
  - `idProducto`, que da el historial completo de la unidad;
  - `idInstalacion`, que busca tanto la atendida como la resultante;
  - `idTecnico`, `tipoServicio`, `estatus`.
- Al técnico se le fuerza su propio `idTecnico`.
- Orden: más recientes primero. Respuesta: `{ "data": [...], "paginated": { "total", "page", "limit" } }`.

## 6. Qué se necesita para cerrar

- Una respuesta (sí o no) para **cada** opción activa de `vehiculo_cuenta_con`, `funcionamiento_vehiculo`, `fallas_equipo` y `pruebas`.
- Si `fallas_equipo.otro` es sí, las `observaciones` son obligatorias.
- Al menos una prueba correcta, salvo en `desinstalacion`.
- Las fotos y firmas marcadas como obligatorias en el catálogo (hoy `tablero_inicio`, `tablero_final`, `firma_cliente`, `firma_tecnico`).
- `idMonitorista`.
- Los datos propios de cada tipo:

| Tipo | Requiere |
|------|----------|
| `instalacion` | `idProducto`, `idDispositivoNuevo` (`idSimNuevo` es opcional) |
| `c_equipo` | `idInstalacion`, `idDispositivoNuevo`, `estatusSalienteAnterior` |
| `c_sim` | `idInstalacion`, `idSimNuevo`, `estatusSalienteAnterior` |
| `desinstalacion` | `idInstalacion`, `estatusInstalacionBaja` (0 o 5) |
| `revision` | `idInstalacion` |

## 7. Movimiento en Instalaciones al cerrar

| Tipo | Llamada | Efecto |
|------|---------|--------|
| `instalacion` | `InstalacionesService.create` | Alta nueva. Producto, equipo y SIM deben estar disponibles (1). La orden queda con `idInstalacion = idInstalacionResultado = nueva` |
| `c_equipo` | `InstalacionesService.update` con `estatusInstalacionAnterior = 3` (BAJA_REMPLAZO), `idDispositivo` y `estatusDispositivoAnterior` | La versión anterior se archiva en `HistoricoInstalaciones` y se crea una instalación con Id nuevo. La orden guarda `idHistoricoInstalacion` |
| `c_sim` | Igual, con `idSim` y `estatusSimAnterior` | Igual |
| `desinstalacion` | `InstalacionesService.baja` con `estatusInstalacion` 0/5 | Baja; los componentes vuelven a disponible. Conserva el Id |
| `revision` | — | Sin cambio |

- En todos los casos, salvo el alta, primero se comprueba que la instalación **siga vigente**. Si otra orden la cambió mientras tanto, responde 400 `"La instalación N ya no está vigente (pudo cambiar por otra orden); actualice la orden"`.
- El comentario del histórico y de la instalación lleva `Orden de servicio OS-000042 (<tipo>): <observaciones>`.
- Al cerrar se registra una entrada en la bitácora (módulo Instalaciones).

### 7.1 Cambio en `InstalacionesService`
`create`, `update` y `baja` reciben un parámetro opcional al final, **`trx?: QueryRunner`**:
- **Sin `trx`** (todos los endpoints de `/instalaciones`): abren, confirman y liberan su propia transacción, **igual que antes**.
- **Con `trx`** (cierre de la orden): trabajan dentro de la transacción del llamador y no confirman, no revierten ni liberan; eso queda a cargo de quien llama.

No cambia ningún contrato de `/instalaciones`.

## 8. Errores

| HTTP | Cuándo |
|------|--------|
| 400 | Cliente inexistente o inactivo; falta `idInstalacion` o no es vigente; alta con `idInstalacion`; campo que no aplica al tipo; clave inexistente en el catálogo; archivo ausente o de tipo no permitido; monitorista inválido; orden incompleta (con `faltantes`); orden que ya no está en borrador; instalación que dejó de estar vigente |
| 404 | La orden no existe o el técnico no tiene acceso |
| 409 | `claveApp` de otra orden ajena |

## 9. Despliegue (springfieldDev) — ya aplicado el 27/10/2026

Orden de los pasos: `git pull` → aplicar el SQL → build → reinicio.

```bash
cd ~/development/node/nextAPI && git pull
mysql -u root -p Next < deploy/sql/OrdenesServicio.sql
npm run build && sudo systemctl restart nextAPI.service
```

Verificación: existen las 4 tablas y el catálogo tiene 24 filas (5/4/5/3/5/2 por sección).

## 10. Pruebas

- `ordenes-servicio.reglas.spec.ts`: qué falta para cerrar en cada tipo, la regla de `otro` y la de las pruebas.
- `ordenes-servicio.service.spec.ts`: alta idempotente, campos por tipo y movimiento al cerrar.
- Resultado: 23 suites y 143 pruebas pasan; `nest build` OK.

## 11. Fuera de alcance / pendientes

- **App Flutter:** usa este contrato; no hay cambios del API pendientes para ella.
- **Front Angular:** mostrar las órdenes en el detalle de la instalación (`GET /paginado` filtrado por `idProducto` o `idInstalacion`, y `GET /:id`). Ver `docs/cambios-front-next.md` §11 en springTrackCam.
- **Alta de clientes en campo:** descartada por regla de negocio.

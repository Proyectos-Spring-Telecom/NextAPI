# Órdenes de servicio e instalaciones — especificación de cambios en NextAPI

**Rama:** `dev-isra` (commits `beb837d`, `533ed11`). **Desplegado** en springfieldDev el 27/10/2026.
**DDL:** `deploy/sql/OrdenesServicio.sql`. **Contrato resumido:** [contratos.md §14.1](contratos.md).
**Código:** `src/ordenes-servicio/` y `src/instalaciones/instalaciones.service.ts`.

> **Etapas 2 y 3 (§12–§14) implementadas en `dev-isra` el 29/10/2026 (desplegadas en springfieldDev; la remediación el 29/10/2026 23:15):** órdenes que nacen en el CRM, código de verificación en mantenimientos, autorización de desinstalación y estado `no_cumplida`. DDL: `deploy/sql/OrdenesServicioEtapa2.sql` (etapa 3: `OrdenesServicioEtapa3.sql`; remediación: `OrdenesServicioEtapa4.sql`). Las §1–§11 describen la etapa 1, ya desplegada.

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
- **Etapa 2:** ver §12.

---

## 12. Etapa 2 — órdenes desde el CRM, código, autorización y no cumplida

**Estado:** diseño revisado e **implementado** en `dev-isra` el 29/10/2026; desplegado en springfieldDev (§12.13). Código: `src/ordenes-servicio/ordenes-flujo.service.ts` (flujo), `integracion-ordenes.controller.ts` + `crm-hmac.guard.ts` (CRM), reglas puras en `ordenes-servicio.reglas.ts`. Lo que quedó distinto del diseño original está marcado como **(implementado)**.

### 12.1 Quién hace qué

| Sistema | Responsabilidad |
|---------|-----------------|
| **CRM** (`crmAPI`, base propia `CRM`) | Cotización, cliente comercial, servicio contratado, cita y técnico asignado, negociaciones (sobreprecio de desinstalación), pago al instalador y cobranza |
| **NextAPI** | Repositorio central de lo operativo: cliente formalizado, vehículo, equipo, SIM, instalación, orden de servicio y su evidencia |
| **App de instaladores** | Recibe las órdenes programadas del técnico, confirma o corrige lo programado en campo, captura la evidencia y cierra |
| **Front de Next** | Operación: crea órdenes cuando no pasan por el CRM, ve los códigos de verificación, autoriza o rechaza desinstalaciones, coordina pruebas |

Principios:
- **El CRM no escribe ni lee la base `Next`.** Hoy lee directo con un pool de solo lectura (`crmAPI/src/postventa/next.service.ts`) y liga las órdenes por aproximación (`sincronizarConApp`). En esta etapa el CRM pasa a usar los endpoints de §12.9: primero para escribir, y para leer las órdenes; lo demás (clientes, SIMs, unidades) puede migrar después.
- **El técnico no decide crear órdenes.** Toda orden nace programada, en el CRM o en el front de Next por operación.
- **Cada orden es un trabajo individual: un vehículo por orden.** No hay agrupaciones que mantener en ninguno de los dos sistemas.

### 12.2 Cliente y vehículo

- **Cliente:** en el CRM vive solo para la cotización. Al formalizar la venta, se da de alta en Next con el endpoint de clientes que ya existe (los datos formales suelen ser distintos de los de la cotización) y el CRM guarda `IdClienteNext`. **Una orden solo se puede programar si el cliente ya existe y está activo en Next** (sigue la regla 1 de §2).
- **Vehículo:** se captura en la App o en el front de Next (regla 2 de §2). El CRM no maneja vehículos.

### 12.3 Origen y unidades

- `Origen`: `crm` (programada por el CRM vía API) o `next` (programada por operación en el front). Las órdenes de operación cubren casos como falta de técnico, de equipo o de señal, o un técnico eventual. El CRM las recibe en la consulta de cambios (§12.9) para pagarlas y cobrarlas.
- **Instalación nueva de N unidades:** el CRM manda una sola petición con `unidades: N` y Next crea N órdenes `programada` independientes. Todas llevan la misma `referenciaCrm` y su `unidad` (1..N). El CRM cuenta las que se cerraron por `referenciaCrm`; no hay grupos que mantener.
- **(implementado) `referenciaCrm` es texto, no un Id numérico:** el CRM tiene tablas distintas para instalaciones y (en el futuro) mantenimientos, y sus Id chocarían. Se recomienda un prefijo por tabla: `OI-123` para `OrdenesInstalacion`, `MT-45` para mantenimientos. La llave única (`referenciaCrm`, `unidad`) hace idempotente la programación.
- **Mantenimiento:** el CRM levanta el servicio con el cliente, **el vehículo** (`idInstalacion`) y el **tipo probable** (`revision`, `c_sim`, `c_equipo`, `desinstalacion`), y asigna técnico.

### 12.4 Confirmar o corregir en campo

En campo, el técnico confirma o corrige lo que se programó:
- **Tipo:** al iniciar la orden puede cambiar el tipo (por ejemplo, una `revision` que termina en `c_equipo`). Se guardan los dos: `TipoProgramado` (lo que mandó el CRM o la operación) y `TipoServicio` (lo que se hizo). Esto reemplaza la regla 3 de §2 ("el tipo no se puede cambiar"): el tipo queda fijo **al iniciar**, no al programar.
- **Vehículo (mantenimientos):** el técnico elige el vehículo en la App y lo confirma con el código de verificación (§12.5). Si es distinto del programado, se guardan los dos (`IdInstalacionProgramada` e `IdInstalacion`) y se registra como discrepancia.

### 12.5 Código de verificación (mantenimientos)

Sirve para asegurar que el técnico trabaja el vehículo correcto. Ocurre cuando el cliente tiene muchas unidades o hay varios servicios el mismo día.

1. El técnico elige el vehículo en la App → `POST /:id/codigo`.
2. NextAPI genera un código de **6 dígitos**, válido **15 min** y con **5 intentos**. **(implementado)** Se guarda en claro mientras está vigente, porque el operador lo tiene que leer para dictarlo; se borra al validarlo, al agotar los intentos o al cerrar la orden, y nunca sale en las respuestas que ve el técnico.
3. **Cualquier operador en turno** (roles 1–5) lo ve en el front, en la lista de códigos pendientes con cliente, placa, económico y técnico. Al abrirlo se registra quién lo vio (`IdUsuarioCodigo`, `FechaCodigoVisto`).
4. El operador se lo dicta al técnico, y éste lo captura → `POST /:id/codigo/validar`.
5. Si es correcto, se guarda `FechaCodigoValidado` y la orden queda ligada a ese vehículo. Si vence o se agotan los intentos, se pide otro.

**Aplica a:** `revision`, `c_sim`, `c_equipo` y `desinstalacion`. No se puede cerrar un mantenimiento sin código validado (se agrega a `faltantesParaCerrar`). **No aplica** a `instalacion`, porque el vehículo se captura ahí mismo.

**(implementado) Transición:** el código solo se exige en las órdenes programadas (con `origen`). Las que la app sigue creando sola con `POST /` (etapa 1) cierran sin código mientras la app migra.

### 12.6 Instalación nueva sobre un vehículo con equipo

La negociación (y el sobreprecio) es de operación o administración, nunca del técnico. Su impacto económico queda en el CRM.

1. El técnico encuentra un equipo instalado → `POST /:id/autorizacion` con evidencia (foto del equipo existente). La orden queda con `Autorizacion = pendiente` y no se puede cerrar.
2. La decisión la toma la operación en el front de Next o el CRM por API (`POST /:id/autorizacion/decision`). Se guarda quién decidió, cuándo y desde dónde.
3. **Autorizada:** el técnico desinstala y sigue con el alta. Si el equipo existente está registrado en Next (instalación vigente en ese vehículo), el cierre aplica la baja de esa instalación (estatus 0, con sus geocercas) y el alta nueva en la misma transacción, y guarda `idInstalacionRetirada`. Si es de terceros (no está en Next), solo queda la evidencia: observaciones y la foto `equipo_existente`.
4. **Rechazada:** la orden se cierra como `no_cumplida` con motivo `sin_autorizacion_desinstalacion`, cobrable (el técnico sí cobra la visita).

### 12.7 Estados y motivos homologados

```
programada ──iniciar──► borrador ──cerrar──► cerrada
    │                      │
    │                      └──no cumplida (motivo)──► no_cumplida
    └──cancelar (motivo)──► cancelada
```

| Estado | Significado |
|--------|-------------|
| `programada` | Creada por el CRM o por operación; el técnico la ve pero no ha empezado |
| `borrador` | El técnico ya la inició en campo (se conserva el nombre de la etapa 1) |
| `cerrada` | Trabajo hecho; se aplicó el movimiento en Instalaciones (§7) |
| `no_cumplida` | El técnico fue, pero el trabajo no se pudo hacer. Lleva motivo y si es cobrable |
| `cancelada` | No se llegó a hacer (antes de iniciar) o se canceló por el sistema. Lleva motivo |

**Quién puede mover cada estado:**

| Desde | Acción | Técnico | Operación (front) | CRM (API) |
|-------|--------|:-:|:-:|:-:|
| `programada` | Reprogramar (cita, técnico) | — | Sí | Sí |
| `programada` | Cancelar | — | Sí | Sí |
| `programada` | Iniciar | Sí | — | — |
| `borrador` | Cerrar | Sí | Sí (roles 1–3) | — |
| `borrador` | No cumplida | Sí | Sí | — |
| `borrador` | Cancelar | — | Sí, con motivo | **No:** responde 409 con el estado actual; el CRM pide a operación que la cierre |

**(implementado) Roles:** "operación" en el front = roles 1–3 (programar, reprogramar, cancelar, no cumplida por otro y ajustar `cobrable`). Ver y dictar el código: roles 1–5 (cualquier operador en turno). Decidir la autorización: roles 1–4. Las órdenes de la etapa 1 (sin origen) el técnico las sigue cancelando en borrador sin motivo.

Una vez iniciada, la orden solo la cierran el técnico o la operación, que es quien sabe qué pasó en campo. El CRM se entera por la consulta de cambios.

**Catálogo de motivos** (`CatMotivosOrdenServicio`, en BD como el de opciones, para homologar el criterio entre la App, el front y el CRM):

| Columna | Uso |
|---------|-----|
| `Clave`, `Nombre` | |
| `Resultado` | `no_cumplida` o `cancelada` |
| `Quien` | `tecnico`, `operacion`, `crm` (lista separada por comas) |
| `Cobrable` | Valor por defecto; operación lo puede cambiar con justificación |
| `Reprogramable` | Si conviene ofrecer una nueva orden programada |
| `RequiereObservaciones` | |

Borrador de motivos (**a validar con operación y administración**):

| Clave | Resultado | Quién | Cobrable | Reprogramable |
|-------|-----------|-------|:-:|:-:|
| `cliente_ausente` | no_cumplida | técnico | Sí | Sí |
| `vehiculo_no_disponible` | no_cumplida | técnico | Sí | Sí |
| `condiciones_inadecuadas` (lugar, clima) | no_cumplida | técnico | Sí | Sí |
| `danio_vehiculo` | no_cumplida | técnico | Sí | Sí |
| `sin_autorizacion_desinstalacion` | no_cumplida | técnico, operación | Sí | No |
| `falta_material` (equipo, SIM, insumos) | no_cumplida | técnico | No | Sí |
| `sin_senal` | no_cumplida | técnico | ? | Sí |
| `vehiculo_equivocado` | no_cumplida | técnico, operación | ? | Sí |
| `cancelada_por_cliente` | cancelada | operación, crm | No | Sí |
| `reprogramada` | cancelada | operación, crm | No | Sí |
| `error_de_captura` / `duplicada` | cancelada | operación, crm | No | No |
| `otro` | ambos | todos | ? | ? |

Una orden `no_cumplida` o `cancelada` reprogramable se reprograma con **una orden nueva** que guarda `IdOrdenOrigen`, para conservar la historia de las visitas.

### 12.8 Datos nuevos en `OrdenesServicio`

| Columna | Tipo | Notas |
|---------|------|-------|
| `Estatus` | VARCHAR(12) | Agrega `programada` y `no_cumplida` |
| `ClaveApp` | CHAR(36) | Pasa a ser NULL hasta que la App inicia la orden |
| `Origen` | VARCHAR(5) | `crm` \| `next` |
| `ReferenciaCrm` | VARCHAR(40) NULL | Referencia de la orden en el CRM (`OI-123`, `MT-45`); UQ con `Unidad` |
| `Unidad` / `UnidadesTotal` | SMALLINT NULL | 1..N de la orden del CRM |
| `IdOrdenOrigen` | BIGINT NULL | Orden no cumplida o cancelada que ésta reprograma |
| `TipoProgramado` | VARCHAR(20) | Lo que se programó; `TipoServicio` queda como lo que se hizo |
| `IdInstalacionProgramada` | BIGINT NULL | Vehículo programado (mantenimientos) |
| `Cita` / `CitaFin` | DATETIME NULL | Hora de Ciudad de México |
| `IdTecnico` | BIGINT | Ahora se asigna al programar (ya no es solo el usuario del token) |
| `IdUsuarioProgramo` | BIGINT NULL | Usuario de Next o del CRM que programó |
| `Codigo`, `CodigoExpira`, `CodigoIntentos` | | Código vigente (§12.5) |
| `IdUsuarioCodigo`, `FechaCodigoVisto`, `FechaCodigoValidado` | | Quién lo vio y cuándo se validó |
| `FechaInicio` | DATETIME NULL | Cuando el técnico la inició |
| `Autorizacion`, `FechaSolicitudAutorizacion` | | `pendiente` \| `autorizada` \| `rechazada` |
| `IdUsuarioAutorizo`, `NombreAutorizo`, `FechaAutorizacion`, `OrigenAutorizacion` | | `OrigenAutorizacion`: `next` \| `crm`. Del CRM: `IdUsuarioAutorizo` NULL y `NombreAutorizo = "CRM: <usuario>"` |
| `IdInstalacionRetirada` | BIGINT NULL | Instalación de Next dada de baja al cerrar un alta autorizada |
| `ClaveMotivo` | VARCHAR(40) NULL | → `CatMotivosOrdenServicio` (no cumplida o cancelada) |
| `Cobrable` | TINYINT NULL | 1/0; nace del motivo y operación lo puede ajustar |
| `IdProductoAutorizacion` | BIGINT NULL | (remediación, `Etapa4`) Vehículo por el que se pidió la autorización de desinstalar |
| `CodigosEmitidos` | TINYINT | (remediación) Códigos emitidos en la orden; tope 5 (`CODIGO.MAX_EMITIDOS`), se reinicia con `POST /:id/codigo/reiniciar` |
| `NotasInternas` | TEXT NULL | (remediación) Notas de operación o del CRM; no salen en el PDF (§17) |

Índices nuevos: UQ (`ReferenciaCrm`, `Unidad`), (`IdTecnico`, `Estatus`, `Cita`), `FechaActualizacion` (para la consulta de cambios; la remediación lo cambia a (`FechaActualizacion`, `Id`) y agrega (`Estatus`, `CodigoExpira`) y (`Estatus`, `Autorizacion`)). Catálogo nuevo `CatMotivosOrdenServicio` (13 motivos) y foto opcional `equipo_existente` en `CatOrdenServicioOpciones`.

### 12.9 Endpoints nuevos

**Para el CRM** (`/api/integracion/ordenes-servicio`; solo desde la red interna). **Firma v2 (desde la remediación del 29/10/2026):** headers `x-crm-firma: v2`, `x-crm-timestamp` (ms), `x-crm-nonce` (UUID por petición) y `x-crm-signature` = HMAC-SHA256 hex de `${timestamp}.${nonce}.${MÉTODO} ${ruta}\n${cuerpo}` con `CRM_HMAC_SECRET`, donde la ruta es la que recibe NextAPI (con `/api` y la query). Cubre método, ruta y cuerpo; cada nonce se acepta una sola vez en la ventana de 5 min. La firma v1 (solo cuerpo) ya no se acepta. Sin `CRM_HMAC_SECRET` responde 503.

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/` | Programar: `{ referenciaCrm, idCliente, tipo, unidades?, idInstalacion?, cita, citaFin?, idTecnico, idOrdenOrigen?, observaciones?, usuario? }` → N órdenes `programada`. Idempotente por (`referenciaCrm`, `unidad`) |
| PATCH | `/:id` | Reprogramar cita o técnico; solo en `programada` (si no, 409 con el estado) |
| POST | `/:id/cancelar` | `{ claveMotivo, observaciones? }`; solo en `programada`. Repetirla sobre una ya cancelada responde 200 ("ya estaba cancelada"): el reintento del CRM tras una respuesta perdida no es un error. La respuesta trae `data.claveMotivo`, el motivo con el que quedó (si la canceló operación, el suyo) |
| POST | `/:id/autorizacion/decision` | `{ autorizada: bool, observaciones? }` |
| GET | `/cambios?desde=<fecha>&despuesDe=<id>&limite=200` | Órdenes creadas o modificadas, ordenadas por (`fechaActualizacion`, `id`), de cualquier origen. Cursor compuesto: pasar `hasta` y `despuesDe` de la respuesta anterior; nunca se atasca aunque muchas órdenes compartan el segundo. El CRM relee con 2 min de traslape (lo confirmado tarde) y procesa de forma idempotente. `hayMas` = pedir otra página |
| GET | `/por-referencia/:referencia` | Estado actual de las órdenes de una referencia y sus tandas (`OI-12`, `OI-12-2`…); el CRM lo consulta antes de reagendar |
| GET | `/motivos` | El catálogo de motivos |

`usuario` (opcional en todas las escrituras) es el nombre del usuario del CRM, para el registro. Con `CRM_ID_USUARIO` (Id de un usuario de Next) las acciones del CRM también quedan en la bitácora.

**Para la App** (`/api/ordenes-servicio`, rol 8):

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/paginado/...?estatus=programada` | Sus órdenes programadas (ya filtra por técnico), ordenadas por cita |
| GET | `/motivos` | Motivos para no cumplida |
| POST | `/:id/iniciar` | `{ claveApp, tipoServicio?, idInstalacion?, idProducto? }` → `borrador` (`idProducto` solo en un alta con el vehículo ya dado de alta). Sustituye a `POST /` para el técnico |
| POST | `/:id/codigo` y `/:id/codigo/validar` | §12.5 |
| POST | `/:id/autorizacion` | §12.6 |
| POST | `/:id/no-cumplida` | `{ claveMotivo, observaciones? }` |

**Para el front de Next** (roles 1–5 según la acción):

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/programar` | Operación programa una orden (`Origen = next`); mismo cuerpo que el del CRM sin `referenciaCrm` |
| PATCH | `/:id/reprogramar` | Cita, técnico o vehículo; solo `programada` |
| GET | `/codigos-pendientes` | Códigos vigentes para dictar |
| POST | `/:id/codigo/ver` | Muestra el código y registra quién lo vio |
| POST | `/:id/codigo/reiniciar` | Roles 1–3: reinicia el tope de 5 códigos de la orden (el técnico lo agotó) |
| GET | `/autorizaciones-pendientes` | Desinstalaciones por decidir |
| POST | `/:id/autorizacion/decision` | Igual que el del CRM, desde el front |
| POST | `/:id/cancelar`, `/:id/no-cumplida` | Con motivo (`claveMotivo`, `observaciones?`, `cobrable?`) |

Filtros nuevos en `GET /paginado`: `origen`, `referenciaCrm`. Listado y detalle traen además `nombreCliente`, `placa`, `numeroEconomico` y `nombreProducto` (del producto de la orden o de la instalación real o programada; 30/10/2026). Las respuestas de la orden agregan: `origen`, `referenciaCrm`, `unidad`, `unidadesTotal`, `idOrdenOrigen`, `tipoProgramado`, `idInstalacionProgramada`, `tipoDistinto`, `vehiculoDistinto`, `cita`, `citaFin`, `nombreProgramo`, `fechaInicio`, `codigoValidado`, `autorizacion`, `nombreAutorizo`, `fechaAutorizacion`, `idInstalacionRetirada`, `claveMotivo`, `cobrable`, `fechaActualizacion`.

**Transición:** `POST /` (el técnico crea el borrador él mismo) se mantiene mientras la App migra a `programada` + `iniciar`. Después queda solo para los roles 1–3.

### 12.10 Cambios en el CRM (referencia; se hacen en `crmAPI`)

- Al formalizar la venta: alta del cliente en Next por API y guardar `IdClienteNext` (ya existe la columna).
- Al agendar: `POST /integracion/ordenes-servicio` con `referenciaCrm = "OI-<IdOrdenInstalacion>"`. Guardar los Id devueltos (ya existe `OrdenesInstalacionApp.IdOrdenServicioNext`). Al reprogramar o cancelar la cita, `PATCH` o `cancelar`.
- `sincronizarConApp` deja de emparejar por aproximación: lee `GET /cambios` y liga por `referenciaCrm`. Las órdenes con `origen = next` llegan sin `referenciaCrm`, y el CRM las registra para pagarlas y cobrarlas.
- Configurar en `crmAPI` la URL de NextAPI por localhost (`http://127.0.0.1:3004/api`) y el mismo secreto que `CRM_HMAC_SECRET` de NextAPI.
- `PagosInstaladorDetalle` toma también las `no_cumplida` con `cobrable = 1`.
- `OrdenesInstalacion.Tecnico` (texto libre) se reemplaza por `IdTecnicoNext`.

### 12.11 Siguiente etapa y correcciones del front

**Siguiente etapa:**
- Qué operador validó cada prueba (transmisión, pánico, paro de motor), y que el paro de motor quede pedido por el sistema.
- PDF de la orden y envío por correo o WhatsApp.

**Correcciones del front:**
- La SIM muestra "IMEI", pero la columna `Sims.IMEI` guarda el **ICCID**. Corregir la etiqueta en el front, el DTO y Swagger; renombrar la columna es opcional.
- "Reasignar" en la fila de instalación es del **dispositivo**: debe usar `PATCH /instalaciones/:id` (cambio con histórico). Ese cambio crea un Id nuevo y **borra las geocercas** de la versión anterior, así que hay que avisarlo en pantalla. No debe usar la reasignación de cliente de `/dispositivos`.
- En Next, estatus 1 de equipo o SIM significa *disponible en almacén*; instalado y operando es **2 ASIGNADO**.

### 12.12 Decisiones tomadas al implementar (ajustables)

1. **Equipo de terceros (§12.6):** solo evidencia (observaciones + foto `equipo_existente`); no se registra marca ni modelo.
2. **Motivos (§12.7):** los "?" quedaron así en el catálogo: `sin_senal` cobrable, `vehiculo_equivocado` no cobrable, `otro` no cobrable (operación lo ajusta). Se cambian con `UPDATE CatMotivosOrdenServicio`, sin publicar código.
3. **Mantenimientos del CRM:** `referenciaCrm` de texto (`MT-<id>`), para cuando el CRM tenga su tabla de mantenimientos.
4. **Código:** 6 dígitos, 15 min, 5 intentos (`CODIGO` en `ordenes-servicio.reglas.ts`). El aviso con sonido queda a cargo del front (consultar `GET /codigos-pendientes` cada pocos segundos mientras la pantalla está abierta).

### 12.13 Despliegue (springfieldDev)

1. `git pull` de `dev-isra`.
2. SQL (idempotente; probado dos veces seguidas sobre una copia del esquema): `mysql -u root -p Next < deploy/sql/OrdenesServicioEtapa2.sql`.
3. `.env` de NextAPI: `CRM_HMAC_SECRET` (mín. 16 caracteres, el mismo que se configure en `crmAPI`) y, opcional, `CRM_ID_USUARIO` (usuario de Next para la bitácora del CRM). Sin el secreto, `/api/integracion/*` responde 503 y lo demás funciona igual.
4. Nginx: no publicar `/api/integracion/` (el CRM llama por localhost), igual que ya se hace con `/crmAPI/integracion/`.
5. `npm run build && sudo systemctl restart nextAPI.service`.

Verificación: 13 filas en `CatMotivosOrdenServicio`, 25 en `CatOrdenServicioOpciones`; `GET /api/ordenes-servicio/motivos` con un JWT responde el catálogo.

### 12.14 Pruebas

- `ordenes-servicio.reglas.spec.ts`: código y autorización en `faltantesParaCerrar`, cambio de tipo, motivos, estado del código.
- `ordenes-flujo.service.spec.ts`: programar N unidades e idempotencia, iniciar con corrección, código (ver, validar, agotar), autorización (rechazo → no cumplida), no cumplida y cobro, cancelar (CRM con 409, etapa 1). **Ya no existe:** la remediación la reemplazó por `test/e2e-ordenes/reglas-flujo.e2e-spec.ts` (las mismas reglas contra MySQL real, §16).
- `ordenes-servicio.service.spec.ts`: cierre de un alta autorizada (baja + alta en la misma transacción) y mantenimiento sin código.
- `crm-hmac.guard.spec.ts`: firma de POST y GET (con y sin `/api`), timestamp vencido, secreto ausente.
- Resultado: 28 suites y 195 pruebas pasan; `nest build` OK.

---

## 13. Etapa 3 — pruebas con el operador, paro de motor y PDF

**Estado:** implementado en `dev-isra` el 29/10/2026. DDL: `deploy/sql/OrdenesServicioEtapa3.sql` (tabla `OrdenServicioPruebas`, columnas `RutaPdf` y `FechaPdf`). Código: `ordenes-flujo.service.ts` (pruebas) y `ordenes-servicio-pdf.service.ts`.

### 13.1 Pruebas validadas por el operador

Las pruebas (transmisión, botón de pánico, paro de motor) se coordinan entre el técnico y el operador. En las **órdenes programadas** (con `origen`) el resultado lo pone el operador, no el técnico:

1. El técnico pide la prueba: `POST /ordenes-servicio/:id/pruebas/:clave/solicitar { observaciones? }`. Para el paro de motor (`clave = paro_motor`) esto es la **solicitud del paro**: el operador lo ejecuta con su herramienta de siempre (Next todavía no manda comandos al equipo) y confirma el resultado.
2. El operador en turno (roles 1–5) ve `GET /ordenes-servicio/pruebas-pendientes` (cliente, placa, técnico, prueba, nota del técnico) y responde `POST /ordenes-servicio/:id/pruebas/:clave/validar { correcta, observaciones? }`.
3. El resultado queda en `OrdenServicioPruebas` (quién, cuándo, notas) y como respuesta de la sección `pruebas`. Volver a pedirla la reabre.

Reglas:
- En una orden programada el `PATCH` rechaza respuestas de la sección `pruebas` (400). Excepción: `desinstalacion`, donde ya no hay equipo que probar y el técnico las contesta.
- No se cierra con pruebas pedidas sin validar (`faltantesParaCerrar`: "Pruebas pendientes de validar por el operador").
- Las órdenes de la etapa 1 (sin origen) siguen como antes: el técnico marca las pruebas.
- `GET /:id` agrega `pruebas: [{ clave, estatus, fechaSolicitud, notaTecnico, fechaValidacion, nombreValido, notaOperador }]`.

### 13.2 PDF de la orden, correo y WhatsApp

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/ordenes-servicio/:id/pdf` | El PDF (inline): servicio, cliente, vehículo, equipo y SIM, checklist, pruebas con quién las validó, autorización, motivo, observaciones y firmas |
| POST | `/ordenes-servicio/:id/compartir` | `{ telefono? }` → `{ url, vigenciaHoras: 168, whatsapp }`. `whatsapp` es un enlace `wa.me` con el texto y el enlace del PDF; con `telefono` abre ese chat |
| POST | `/ordenes-servicio/:id/enviar-correo` | `{ correos: [..] }` (1–5) → correo con el PDF adjunto, desde la cuenta SMTP de NextAPI |

- Compartir y enviar solo funcionan con la orden `cerrada` o `no_cumplida`; el PDF se puede ver en cualquier estado.
- Cada vez que se comparte se genera un PDF nuevo en S3 (`ordenes-servicio/pdf/`, privado) con los datos de ese momento; los anteriores no se borran, para no romper enlaces ya enviados. El enlace dura 7 días (máximo de S3).
- Roles: ver el PDF, los que leen órdenes (1–5 y el técnico, solo las suyas); compartir y enviar por correo, solo el técnico de la orden y los roles 1–3 (§17).
- Dependencia nueva: `pdfkit` (`npm install` al desplegar).

## 14. API para el CRM (`/api/integracion`)

**Estado:** implementado el 29/10/2026. Con esto el CRM deja de leer la base de Next. Misma firma HMAC que §12.9; solo por localhost.

| Método | Ruta | Devuelve |
|--------|------|----------|
| GET | `/integracion/clientes` | Clientes activos (sin la cuenta raíz) con `unidades` activas |
| GET | `/integracion/clientes/:id` | Datos de alta (nombre, RFC, contacto, dirección) |
| POST | `/integracion/clientes` | **Alta del cliente formalizado.** Mismo cuerpo que `POST /clientes` en JSON, con al menos un contacto de emergencia. RFC repetido → 409 con `idCliente` (para ligarlo). Requiere `CRM_ID_USUARIO` (usuario de Next que queda como autor; sin él, 503) |
| GET | `/integracion/tecnicos` | Usuarios activos rol 8 |
| GET | `/integracion/unidades?clientes=1,2` | Unidades activas (instalación, placa, económico, IMEI, serie, tipo, fecha). `ordenFolio`: la orden (alta o cambio de equipo) que dejó vigente la instalación; con ella la fecha es la real y el CRM no la corrige a mano |
| GET | `/integracion/unidades/conteo` | Unidades activas por cliente |
| GET | `/integracion/sims` | SIMs con su instalación vigente (`iccid` = `Sims.IMEI`) |
| GET | `/integracion/ordenes-realizadas?tecnicos=&clientes=&desde=&tipo=&pagables=1` | Órdenes cerradas (y con `pagables=1`, las no cumplidas cobrables) con técnico, cliente, `estatus`, `motivo`, `referenciaCrm` |
| GET | `/integracion/ordenes-servicio/autorizaciones-pendientes` | Para decidir desde el CRM (§12.6) |

## 15. Guía para la App de instaladores (resumen del flujo)

Todo con el JWT del técnico (rol 8). Detalle de cada llamada en §5 y §12–§13.

1. **Agenda:** `GET /ordenes-servicio/paginado/1/50?estatus=programada` (ordenadas por cita). Mostrar cliente, tipo programado, vehículo (`idInstalacionProgramada`) y cita.
2. **Iniciar en el lugar:** `POST /:id/iniciar { claveApp, tipoServicio?, idInstalacion?, idProducto? }`. El técnico confirma o corrige el tipo (solo entre mantenimientos) y el vehículo. En un alta, el vehículo se busca o crea como hoy (§2 regla 2) y se manda `idProducto` en el `PATCH`.
3. **Mantenimientos — código:** `POST /:id/codigo`; el operador en turno lo dicta; `POST /:id/codigo/validar { codigo }`. Sin código validado no se cierra.
4. **Alta sobre un vehículo con equipo:** foto `equipo_existente` (`POST /:id/archivos/equipo_existente`) y `POST /:id/autorizacion { observaciones }`. Esperar la decisión (`GET /:id` → `autorizacion`): `autorizada` sigue; `rechazada` deja la orden no cumplida (ya no se edita).
5. **Checklist, fotos y firmas:** como hoy (`PATCH`, archivos). En órdenes programadas **no** se mandan respuestas de `pruebas` (400), salvo en desinstalación.
6. **Pruebas con el operador:** `POST /:id/pruebas/:clave/solicitar { observaciones? }` para `transmision`, `boton_panico` y `paro_motor` (es la solicitud del paro). Mostrar el estado con `GET /:id` → `pruebas[]` (solicitada / correcta / fallida, nota del operador). Si falló, se puede volver a pedir.
7. **Cerrar:** `POST /:id/cerrar`; si responde 400, mostrar `faltantes`.
8. **No se pudo hacer:** `POST /:id/no-cumplida { claveMotivo, observaciones? }` con los motivos de `GET /ordenes-servicio/motivos` donde `quien` incluye `tecnico`.
9. **Compartir:** `POST /:id/compartir { telefono? }` → abrir `whatsapp`; o `POST /:id/enviar-correo { correos }`. `GET /:id/pdf` para verlo.

Mientras la App migra, `POST /` (crear la orden en campo) sigue funcionando con las reglas de la etapa 1.

## 16. Batería de punta a punta

`npm run test:e2e-ordenes` (detalle en `test/e2e-ordenes/README.md`). Levanta MySQL desechable con las bases `Next` y `CRM`, arranca NextAPI y crmAPI reales sin `.env` (secretos de prueba, RabbitMQ apagado, S3 y correo simulados) y recorre cuatro escenarios con los actores reales (CRM, App del técnico, monitoreo, operación): instalación de varias unidades con no cumplida y reagendado hasta el pago al técnico; mantenimiento corregido en campo con código; vehículo con equipo existente (rechazo y autorización con sobreprecio a cobranza); cancelaciones. Deja un reporte narrado por corrida en `test/e2e-ordenes/reportes/`, para explicar el modelo a los usuarios.

Correcciones que encontró la batería (29/10/2026):
- **Errores con datos además del mensaje** (`HttpStringResponseFilter`): antes se perdían; ahora van como JSON `{ message, ...datos }`. La App recibe `faltantes` al intentar cerrar una orden incompleta (§5.6) y el CRM el `idCliente` del 409 de `/integracion/clientes`. Los demás errores siguen siendo texto.
- **Alta autorizada sobre un vehículo con equipo** (§12.6): `InstalacionesService.create` validaba el producto fuera de la transacción del cierre y no veía que la baja de la instalación anterior ya lo había liberado; ahora valida con el `manager` de la transacción.


## 17. Remediación del 29/10/2026

Ver [remediacion-ordenes-servicio.md](remediacion-ordenes-servicio.md): bugs, seguridad y deuda que encontró la revisión independiente, con la prueba de punta a punta que demuestra cada corrección. Cambios de contrato:
- Firma v2 con nonce (§12.9).
- Cursor de `cambios` compuesto (§12.9) y `por-referencia`.
- Transiciones condicionales: una petición que llega cuando la orden ya cambió recibe **409** ("cambió mientras tanto").
- La autorización de desinstalar queda ligada al vehículo (`idProductoAutorizacion`): hay que indicar el vehículo antes de pedirla, no se puede cambiar después, y solo se da de baja ese.
- El código de verificación lo pide y valida **solo el técnico asignado**; tope de 5 códigos por orden; los intentos se descuentan de forma atómica.
- Un alta sobre un vehículo con equipo de Next no cierra sin autorización (faltante explícito).
- El paro de motor solo se exige si el vehículo tiene inmovilizador.
- Compartir y enviar el PDF: técnico de la orden y administración (monitoreo solo lo ve). El PDF al cliente no lleva "cobrable" ni notas internas. WhatsApp con 10 dígitos lleva la lada 52.
- Pruebas pedidas se anulan si la orden se cierra sin hacer el trabajo; el operador solo valida pruebas pedidas.
- Compartir y ver el código no "cambian" la orden para el CRM.
- DDL: `deploy/sql/OrdenesServicioEtapa4.sql`.

Segunda revisión (29/10/2026):
- **`notasInternas`** (columna `NotasInternas`): lo que decide operación o el CRM (autorización, sobreprecio, motivo de cancelación) va ahí y no a `observaciones`, que sale en el PDF del cliente. El detalle la devuelve a todos menos al técnico.
- Validar el código correcto responde **409** si mientras tanto se emitió otro (el técnico lo pidió de nuevo); pedir el nuevo.
- `POST /:id/codigo/reiniciar` (roles 1–3) cuando el técnico agota los 5 códigos.
- Cancelar desde el CRM una orden ya cancelada responde 200 (reintentos idempotentes), con `data.claveMotivo` del motivo con el que quedó.
- Las órdenes de la etapa 1 (creadas por la App) no piden el faltante "vehículo con equipo".

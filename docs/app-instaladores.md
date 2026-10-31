# App de instaladores — contrato con NextAPI

Guía para quien desarrolla la App móvil de instaladores (Flutter). El usuario de la App es el **técnico (rol 8)**. Aquí está qué llamar, cuándo, con qué cuerpo, qué regresa y qué errores atender. El detalle de negocio está en [ordenes-servicio.md](ordenes-servicio.md) (§12, §13, §17). Si esta guía y el código no coinciden, manda el código (`src/ordenes-servicio/`).

- **Base:** `https://<host>/api` (todas las rutas de abajo van después de `/api`).
- **Auth:** header `Authorization: Bearer <token>` en todo, salvo el login.
- **Cuerpos:** JSON (`Content-Type: application/json`), salvo la subida de archivos (multipart).
- **Fechas:** se envían en ISO 8601 **con zona** (`2026-10-30T10:42:00-06:00`). Las que regresa el API (`cita`, `fechaInicio`, `fechaCierre`…) son **hora de pared de Ciudad de México** aunque el JSON traiga `Z`: mostrarlas tal cual, sin convertir de zona.

## 1. Login y token

| Llamada | Cuerpo | Respuesta |
|---------|--------|-----------|
| `POST /login` | `{ "userName": "...", "password": "..." }` | `200 { "token": "...", "refreshToken": "..." }` |
| `POST /login/refresh` | `{ "refreshToken": "..." }` | `{ "token": "...", "refreshToken": "..." }` (guarda el nuevo `refreshToken`) |
| `GET /login/me` | — | Perfil del usuario del token |
| `POST /login/logout` | — | Cierra la sesión |

- Credenciales malas → **401** (texto). El login tiene límite de intentos → **429**.
- La App es solo para rol 8: si `me` no es rol 8, no dejar entrar. Con rol 8 el API ya filtra: el técnico solo ve y toca **sus** órdenes.
- Token vencido → 401 en cualquier llamada: refrescar una vez y reintentar; si el refresh falla, mandar a login.

## 2. Catálogos (cargar al iniciar sesión y cachear)

**`GET /ordenes-servicio/catalogo`** — las pantallas se arman con esto, no con listas fijas:

```json
{ "data": [ {
  "secciones": {
    "vehiculo_cuenta_con":     [ { "clave": "inmovilizador", "nombre": "Inmovilizador", "obligatorio": false } ],
    "funcionamiento_vehiculo": [ ... ], "fallas_equipo": [ ... ],
    "pruebas": [ { "clave": "transmision", ... }, { "clave": "boton_panico", ... }, { "clave": "paro_motor", ... } ],
    "fotos":   [ { "clave": "tablero_inicio", "nombre": "Tablero al iniciar", "obligatorio": true }, ... ],
    "firmas":  [ { "clave": "firma_cliente", "obligatorio": true }, { "clave": "firma_tecnico", "obligatorio": true } ]
  },
  "monitoristas": [ { "id": 15, "nombre": "Ana López Ruiz" } ]
} ] }
```

**`GET /ordenes-servicio/motivos`** — motivos de no cumplida. Mostrar solo los que tienen `"no_cumplida"` en `resultado` **y** `"tecnico"` en `quien`:

```json
{ "data": [ { "clave": "cliente_ausente", "nombre": "...", "resultado": ["no_cumplida"], "quien": ["tecnico"],
              "cobrable": true, "reprogramable": true, "requiereObservaciones": false } ] }
```
Si `requiereObservaciones` es `true`, pedir el texto antes de enviar.

## 3. Agenda y detalle

**Agenda:** `GET /ordenes-servicio/paginado/1/50?estatus=programada` → `{ data: [orden...], paginated: { total, page, limit } }`, ordenada por `cita` ascendente (`limit` máx. 100). El API ya filtra por el técnico del token. Para "en curso" usar `?estatus=borrador`; para historial, `cerrada` / `no_cumplida` (más recientes primero).

**Detalle:** `GET /ordenes-servicio/:id` → `{ data: [ orden ] }`. Campos útiles:

| Campo | Uso en la App |
|-------|---------------|
| `id`, `folio` (`OS-000042`) | Identificación |
| `estatus` | `programada` → `borrador` (iniciada) → `cerrada` / `no_cumplida`; o `cancelada` |
| `tipoProgramado`, `tipoServicio` | Lo que se programó y lo que se está haciendo. Tipos: `instalacion` (alta), `revision`, `c_sim`, `c_equipo`, `desinstalacion` |
| `cita`, `citaFin`, `nombreProgramo`, `observaciones` | Datos de la visita |
| `idCliente`, `nombreCliente` | Cliente |
| `placa`, `numeroEconomico`, `nombreProducto` | Vehículo de la orden (o el de la instalación programada mientras no se captura); `nombreProducto` para lo que no es vehículo. `null` si aún no hay |
| `idInstalacionProgramada` | Instalación programada (mantenimientos) |
| `idInstalacion`, `idProducto` | Vehículo real (al iniciar / al capturar) |
| `referenciaCrm`, `unidad`, `unidadesTotal` | Alta de varias unidades: "unidad 2 de 5" (cada una es una orden independiente) |
| `codigoValidado` | Mantenimientos: ya se validó el código |
| `autorizacion` | `null` / `pendiente` / `autorizada` / `rechazada` (alta sobre vehículo con equipo) |
| `pruebas[]` | `{ clave, estatus, fechaSolicitud, notaTecnico, fechaValidacion, nombreValido, notaOperador }`; `estatus`: `solicitada` / `correcta` / `fallida` / `anulada` |
| `respuestas[]` | `{ seccion, clave, valor: bool }` ya guardadas |
| `archivos[]` | `{ clave, fechaCreacion, url }`; la `url` firmada dura **5 min** (no guardarla) |
| `faltantesParaCerrar` | Solo en `borrador`: lista de textos en español, lista para mostrar. Vacía = se puede cerrar |
| `claveMotivo` | Motivo de no cumplida / cancelación |

El listado (agenda) trae los mismos campos de cliente y vehículo que el detalle.

## 4. Iniciar en campo

**`POST /ordenes-servicio/:id/iniciar`**

```json
{ "claveApp": "3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90", "tipoServicio": "c_equipo", "idInstalacion": 340 }
```

- `claveApp` (obligatorio): **UUID v4 que genera la App una sola vez por orden** y guarda localmente. Reenviar con la misma clave (p. ej. se cayó la red) responde `200` "La orden ya estaba iniciada". No generar otra clave al reintentar.
- `tipoServicio` (opcional): solo si el tipo real difiere del programado. Solo se cambia **entre mantenimientos** (`revision` ↔ `c_sim` ↔ `c_equipo` ↔ `desinstalacion`). Alta ↔ mantenimiento → **400** ("operación debe programar otra orden").
- Mantenimientos: `idInstalacion` opcional (por defecto el programado); debe ser vigente y del cliente (si no, 400). **No** mandar `idProducto` (400).
- Alta (`instalacion`): **no** mandar `idInstalacion` (400). `idProducto` opcional aquí si el vehículo ya existe; si no, se manda después en el `PATCH` (§5).
- Respuesta: `{ "status": "success", "message": "Orden iniciada", "data": { "id": 42, "nombre": "OS-000042" } }`.
- Errores: **404** la orden no es del técnico (o la reasignaron a otro); **409** ya no está `programada` (la cancelaron/reprogramaron) o "cambió mientras tanto"; **409** `claveApp` usada en otra orden.

Antes de iniciar, la orden no acepta `PATCH`, archivos ni pruebas (400/409).

## 5. Checklist y datos de la orden

**`PATCH /ordenes-servicio/:id`** — guardado parcial, solo en `borrador`. Mandar solo lo que cambió; `null` borra un valor. Se puede llamar las veces que sea (autoguardado).

```json
{
  "idMonitorista": 15,
  "fechaCaptura": "2026-10-30T10:42:00-06:00", "lat": 18.9395, "lng": -99.2534,
  "idProducto": 812, "idDispositivoNuevo": 981, "idSimNuevo": 77,
  "observaciones": "Cable de alimentación sulfatado",
  "respuestas": [ { "seccion": "vehiculo_cuenta_con", "clave": "inmovilizador", "valor": true },
                  { "seccion": "fallas_equipo", "clave": "otro", "valor": true } ]
}
```

| Campo | Notas |
|-------|-------|
| `respuestas` | `seccion` ∈ `vehiculo_cuenta_con`, `funcionamiento_vehiculo`, `fallas_equipo` (y `pruebas` solo en `desinstalacion`). Se agregan o reemplazan por (`seccion`, `clave`). **Hay que responder todas** (sí o no) para cerrar. Clave inexistente → 400 con la lista |
| `idMonitorista` | De `catalogo.monitoristas` (rol 4/5 activo). Obligatorio para cerrar |
| `fechaCaptura`, `lat`, `lng` | Reloj y GPS del teléfono; `lat`/`lng` en `null` si se negó el permiso |
| `observaciones` | Obligatorias si `fallas_equipo.otro` = sí |
| `idProducto` | Solo `instalacion`: el vehículo (del cliente). Ver §7 si ya tiene equipo |
| `idDispositivoNuevo` | `instalacion`, `c_equipo`: equipo que entra. Del almacén (sin cliente) o reservado al cliente de la orden; reservado a otro cliente → 400 al cerrar. Para elegirlo: `GET /dispositivos/list?idCliente=<cliente de la orden>` (trae lo reservado y el almacén) |
| `idSimNuevo` | `instalacion` (opcional), `c_sim`: SIM que entra. Igual que el equipo: `GET /sims/list?idCliente=<cliente>` |
| `estatusSalienteAnterior` | `c_equipo`, `c_sim`: a dónde va el equipo/SIM que sale: **3 por revisar, 4 laboratorio o 5 inservible** (desde el 30/10/2026; 0 y 1 ya no se aceptan) |
| `estatusInstalacionBaja` | `desinstalacion`: 0 = inactiva (el equipo y la SIM van a revisión), 5 = inservible (el equipo queda inservible; la SIM a revisión) |

- Un campo que no aplica al tipo → **400** `"<campo> no aplica a una orden de tipo <tipo>"`.
- En órdenes programadas **no** mandar respuestas de `pruebas` (400 "las valida el operador"), salvo en `desinstalacion`, donde el técnico las contesta.
- Respuesta: `{ "status": "success", "message": "Orden de servicio guardada", "data": { "id", "nombre" } }`.

**Fotos y firmas:** `POST /ordenes-servicio/:id/archivos/:clave`, multipart con el campo **`file`**. Solo PNG o JPG (convertir HEIC/WEBP a JPG en la App); máx. 10 MB por defecto. `clave` de `catalogo.secciones.fotos` o `.firmas`. Subir la misma clave otra vez la reemplaza.

- Obligatorias para cerrar (las que traen `obligatorio: true`): hoy `tablero_inicio`, `tablero_final`, `firma_cliente`, `firma_tecnico`.
- Opcionales: `falla_extra_1..3`, y `equipo_existente` (evidencia de §7; el API no la exige, pero operación la necesita para decidir).
- Errores: 400 clave inexistente, sin `file`, tipo no permitido o la orden ya no está en borrador; 413 si excede el tamaño.

## 6. Vehículo nuevo (altas)

Si el vehículo no existe en Next, la App lo crea: **`POST /productos/vehiculos`** con al menos `{ "idCliente": 12, "placa": "ABC1234" }` (opcionales: `numeroEconomico`, `idMarcaVehiculo`, `idModeloVehiculo`, `anio`, `color`, `numeroSerie`, `idCombustible`; acepta multipart si se mandan fotos). Responde `{ "status": "success", "data": { "id": <idProducto> } }`. Ese `id` va en el `PATCH` como `idProducto`.

Para buscar uno existente: `GET /productos/vehiculos/placa/:placa` (400 si hay más de uno con esa placa).

## 7. Alta sobre un vehículo que ya tiene equipo

Si el vehículo del alta tiene una instalación vigente en Next, la orden no cierra sin autorización de operación. La App se entera porque `faltantesParaCerrar` incluye "El vehículo ya tiene un equipo instalado: pide autorización para desinstalarlo".

1. **Primero** fijar el vehículo: `PATCH { "idProducto": 812 }` (sin vehículo → 400 "Primero indica el vehículo").
2. Foto del equipo encontrado: `POST /:id/archivos/equipo_existente`.
3. `POST /ordenes-servicio/:id/autorizacion` `{ "observaciones": "GPS de otra marca bajo el tablero" }`. Si el vehículo no tiene equipo registrado en Next → 400 (no hace falta autorización). Repetirla responde 200 "ya estaba pedida".
4. **Esperar la decisión** consultando `GET /:id` cada 10–15 s (no hay push): campo `autorizacion`.
   - `autorizada`: desinstalar y seguir con el alta normal. Al cerrar, Next da de baja la instalación anterior.
   - `rechazada`: la orden queda `no_cumplida` (motivo `sin_autorizacion_desinstalacion`); ya no se edita. Mostrarlo y regresar a la agenda.
5. Una vez pedida (o autorizada), **el vehículo no se puede cambiar**: `PATCH` con otro `idProducto` → 400.

## 8. Código de verificación (mantenimientos)

Aplica a `revision`, `c_sim`, `c_equipo` y `desinstalacion` programadas. Confirma que el técnico está en el vehículo correcto. Sin código validado no se cierra.

1. `POST /ordenes-servicio/:id/codigo` (sin cuerpo) → `{ "status", "message", "data": { "id", "nombre" }, "expira": "<fecha>" }`. El código **no** llega a la App: lo ve el operador en turno, que se lo dicta por teléfono. Vigencia 15 min.
   - Pedirlo otra vez en menos de 1 min devuelve el mismo; después genera uno nuevo (y el anterior deja de servir).
   - **Tope de 5 códigos por orden:** el sexto → **409**. Mostrar "Comunícate con operación para que reinicie los códigos" (operación lo reinicia desde el front); no reintentar.
2. `POST /ordenes-servicio/:id/codigo/validar` `{ "codigo": "482913" }` (6 dígitos).
   - Correcto → 200 "vehículo confirmado"; `codigoValidado` pasa a `true`.
   - Incorrecto → 400 "Código incorrecto (quedan N intentos)". 5 intentos por código; agotados o vencido → 400 "…: pida otro".
   - **409** "Se emitió otro código mientras tanto": el operador dictó uno viejo; capturar el nuevo.
- Solo el **técnico asignado** puede pedir y validar (otro usuario → 404). En un alta → 400.

## 9. Pruebas validadas por el operador

En órdenes programadas el técnico **pide** la prueba y el operador de monitoreo pone el resultado.

1. `POST /ordenes-servicio/:id/pruebas/:clave/solicitar` `{ "observaciones": "presioné el pánico 10:42" }` (cuerpo opcional). `clave`: `transmision`, `boton_panico`, `paro_motor` (para el paro es la solicitud de que el operador lo ejecute). Clave fuera del catálogo → 400.
2. Consultar `GET /:id` → `pruebas[]` cada 10–15 s hasta que la prueba pase de `solicitada` a `correcta` o `fallida` (mostrar `nombreValido` y `notaOperador`).
3. Si falló, se puede volver a pedir (la reabre como `solicitada`).

Reglas para cerrar: cada prueba requerida debe tener resultado y **al menos una correcta**. `paro_motor` solo se exige si el vehículo tiene inmovilizador (`vehiculo_cuenta_con.inmovilizador` = sí); si no lo tiene, no pedirla (una prueba pedida y sin validar también bloquea el cierre). Si la orden termina como no cumplida, las pruebas pendientes quedan `anulada`.

## 10. Cerrar

**`POST /ordenes-servicio/:id/cerrar`** (sin cuerpo). Antes, revisar que `faltantesParaCerrar` esté vacío.

- OK → `{ "status": "success", "message": "Orden de servicio cerrada", "data": { "id", "nombre", "idInstalacionResultado" } }`. Repetirlo responde lo mismo ("ya estaba cerrada"): es seguro reintentar si se perdió la respuesta.
- Incompleta → **400 JSON** `{ "message": "La orden está incompleta", "faltantes": ["Falta el monitorista", "Faltan archivos: firma_cliente"] }`: mostrar la lista tal cual.
- Otros 400 en texto (p. ej. la orden ya no está en borrador o falló el movimiento en Instalaciones); 409 si otra acción se adelantó.

## 11. No cumplida

Cuando el trabajo no se pudo hacer: **`POST /ordenes-servicio/:id/no-cumplida`** `{ "claveMotivo": "cliente_ausente", "observaciones": "..." }`.

- Solo en `borrador` (antes hay que iniciarla); si no → 409.
- `claveMotivo` de `/motivos` permitido para `tecnico`; si no aplica → 400. Sin observaciones cuando el motivo las requiere → 400.
- El técnico **no** manda `cobrable` (→ 403); lo decide el motivo u operación.
- El técnico no cancela órdenes programadas (403/409): si el servicio ya no va, lo cancela operación.

## 12. PDF y compartir

| Llamada | Cuerpo | Respuesta |
|---------|--------|-----------|
| `GET /ordenes-servicio/:id/pdf` | — | `application/pdf` (cualquier estado) |
| `POST /ordenes-servicio/:id/compartir` | `{ "telefono": "7771234567" }` (opcional, 10–15 dígitos) | `{ data: [ { id, folio, url, vigenciaHoras: 168, whatsapp } ] }` → abrir `whatsapp` (`wa.me`); 10 dígitos se completan con lada 52 |
| `POST /ordenes-servicio/:id/enviar-correo` | `{ "correos": ["cliente@empresa.com"] }` (1–5) | `{ status, message }` |

Compartir y enviar solo con la orden `cerrada` o `no_cumplida` (si no → 400). Los puede usar el técnico de la orden.

## 13. Errores: manejo genérico

El cuerpo de error es **texto plano** (el mensaje en español), salvo cuando trae datos extra: entonces es **JSON** `{ "message": "...", ...datos }` (hoy: `faltantes` al cerrar). La App debe intentar parsear JSON y, si falla, usar el texto.

| HTTP | Qué hacer |
|------|-----------|
| 400 | Validación o regla de negocio: mostrar el mensaje. Errores de validación vienen unidos por `, ` |
| 401 | Refrescar token (§1) |
| 403 | Acción no permitida al técnico: mostrar el mensaje, no reintentar |
| 404 | La orden no existe o **ya no es del técnico** (reasignada): quitarla de la vista y recargar la agenda |
| 409 | El estado cambió ("cambió mientras tanto", "La orden está X; no se puede…", código agotado/reemplazado): **recargar `GET /:id`** y decidir con el estado nuevo. No reintentar a ciegas |
| 5xx / red | Reintentar con espera. `iniciar` (misma `claveApp`), `PATCH`, archivos y `cerrar` son seguros de repetir |

## 14. Transición (etapa 1)

`POST /ordenes-servicio` (el técnico crea él mismo el borrador con `{ claveApp, tipoServicio, idCliente, idInstalacion?, idProducto? }`) **sigue funcionando** mientras la App migra. Esas órdenes (sin `origen`) no piden código, el técnico marca las pruebas en el `PATCH` y las puede cancelar en borrador sin motivo. La versión nueva de la App debe usar solo la agenda + `iniciar`; cuando ya no queden borradores sin origen, `POST /` quedará solo para operación.

## 15. Secuencias de punta a punta

**Alta (instalación nueva):**
1. Login → cargar `catalogo` y `motivos`.
2. Agenda `?estatus=programada` → elegir la orden (`tipoProgramado = instalacion`).
3. `POST /:id/iniciar { claveApp }` (guardar la `claveApp`).
4. Buscar o crear el vehículo (`POST /productos/vehiculos`) → `PATCH { idProducto }`.
5. Si `faltantesParaCerrar` pide autorización → foto `equipo_existente`, `POST /:id/autorizacion`, esperar `autorizada` (§7).
6. `PATCH` con checklist, `idMonitorista`, `idDispositivoNuevo`, `idSimNuevo`, `fechaCaptura`, `lat`/`lng`.
7. Subir `tablero_inicio`, `tablero_final`, `firma_cliente`, `firma_tecnico`.
8. Pedir `transmision`, `boton_panico` y (si hay inmovilizador) `paro_motor`; esperar el resultado del operador.
9. `GET /:id` → `faltantesParaCerrar` vacío → `POST /:id/cerrar`.
10. `POST /:id/compartir { telefono }` → abrir WhatsApp, o `enviar-correo`.

**Mantenimiento (p. ej. revisión que termina en cambio de equipo):**
1. Agenda → orden `revision` con `idInstalacionProgramada`.
2. `POST /:id/iniciar { claveApp, tipoServicio: "c_equipo", idInstalacion? }`.
3. `POST /:id/codigo` → el operador lo dicta → `POST /:id/codigo/validar { codigo }`.
4. `PATCH` con checklist, `idMonitorista`, `idDispositivoNuevo`, `estatusSalienteAnterior`, `fechaCaptura`, `lat`/`lng`.
5. Fotos y firmas obligatorias.
6. Pedir pruebas y esperar al operador (en `desinstalacion` no: el técnico las responde en el `PATCH` y manda `estatusInstalacionBaja`).
7. `POST /:id/cerrar` → compartir.

**No se pudo:** iniciar (si no se había iniciado) → `POST /:id/no-cumplida { claveMotivo, observaciones? }`.

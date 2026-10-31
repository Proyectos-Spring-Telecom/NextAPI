# Motor de activos y visibilidad (diseño para revisión)

**Estado:** diseño del 30/10/2026 con las decisiones de Israel (§12). **Fase A implementada el 30/10** (§13); siguen B–F. Parte del diagnóstico ([diagnostico-modelo.md](diagnostico-modelo.md)).

## 0. Principios (acordados)

1. **Next es la fuente de verdad.** Cualquier cambio de un activo (dispositivo, SIM, vehículo/producto) o de una instalación pasa por **un solo motor**, venga del front, la App, el CRM o una orden de servicio. Ningún endpoint escribe estatus o clientes por su cuenta.
2. **Las posiciones de un vehículo son las de su equipo mientras estuvo instalado** (desde que se instaló hasta que se desinstaló). La evidencia no se mueve ni se borra: lo que transmitió se queda con el cliente y el vehículo de ese periodo, aunque después cambien las combinaciones.
3. **Los activos son del negocio:** cada dispositivo y SIM tiene historial de vida completo (dónde estuvo, con qué cliente, por qué salió, quién lo movió).
4. **Un dispositivo disponible no tiene cliente**: está en el almacén (catálogo de dispositivos) hasta que se instala.
5. **Un vehículo puede tener varios equipos a la vez** (GPS/AVL para seguridad y control, TrackCam para la capa de IA), uno por clase de equipo.
6. **Quién ve qué** se decide en un solo lugar (`TenantFilterService`, ya hecho el 30/10): cliente según el rol, árbol de clientes, y para 7/9 solo lo asignado.

## 1. Estatus de los recursos

Hoy dispositivos, SIM y productos usan la escala de `CatEstatusInstalacion` (que en realidad describe **por qué terminó una instalación**). Propuesta: separar las dos cosas.

**Catálogo nuevo `CatEstatusRecurso`** (dispositivo y SIM): **dónde está y en qué condición**. Se conservan los números actuales para no romper datos ni front:

| Id | Código | Significado | Cliente |
|---|---|---|---|
| 0 | INACTIVO | Fuera de operación por decisión administrativa (reversible: p. ej. suspendido, extraviado en investigación) | Sin cliente |
| 1 | DISPONIBLE | En almacén, listo para instalarse | **Sin cliente** |
| 2 | INSTALADO | En una instalación activa (solo lo pone el motor) | El de la instalación |
| 3 | POR_REVISAR | Salió de una instalación (reemplazo, desinstalación) y hay que revisarlo antes de volver a disponible. **Unifica el "3 = revisión" de la SIM** | Sin cliente |
| 4 | LABORATORIO | En reparación | Sin cliente |
| 5 | INSERVIBLE | Baja definitiva (daño, vandalismo). Terminal | Sin cliente |

**Transiciones permitidas** (todo lo demás → 400):

| De → a | Cómo |
|---|---|
| 1 → 2 | Instalar |
| 2 → 3 / 4 / 5 | Desinstalar o cambio de componente (el motivo de la instalación decide a cuál) |
| 3 → 1 / 4 / 5 | Revisión: sirve, a laboratorio o inservible |
| 4 → 1 / 5 | Rehabilitar o declarar inservible |
| 1 → 0, 3 → 0, 0 → 1 | Inactivar / reactivar (administración) |
| 5 → (nada) | Terminal; solo roles 1–2 con motivo, por corrección de captura |

**`CatEstatusInstalacion`** se queda como está: el **motivo con que terminó** una versión de instalación (3 baja por reemplazo, 4 por mantenimiento, 5 no funcional, 0 inactiva). El motor guarda ese motivo en el histórico y pone el estatus del recurso según la tabla de arriba.

**Producto (vehículo, persona, inmueble, activo):** deja de usar "asignado". Estatus: 1 activo, 0 inactivo, 5 baja. Que tenga equipo se sabe por sus instalaciones activas, no por su estatus (eso es lo que hoy impide GPS + TrackCam).

## 2. Cliente de los recursos

- `Dispositivos.IdCliente` y `Sims.IdCliente` pasan a **NULL = en almacén**. Al instalar, el motor pone el cliente de la instalación; al salir, lo regresa a NULL.
- **Por qué hoy no se puede cambiar el cliente de un equipo con historial:** `HistoricoInstalaciones` apunta al equipo por `(IdCliente, IdDispositivo)`. Si el equipo cambia de cliente, la FK del histórico se rompe. Propuesta:
  - `HistoricoInstalaciones` → FK **simple** a `Dispositivos(Id)`, `Sims(Id)`, `Productos(Id)`. Su `IdCliente` se queda como **el cliente de ese periodo** (evidencia), no como amarre.
  - `Instalaciones` (vigentes) conserva la FK compuesta: mientras está instalado, el equipo **es** del cliente de la instalación.
  - `RelojConfig`, `TrackcamConfig`, `PanelAlarma` → FK simple a `Dispositivos(Id)`: la configuración es del equipo, no del cliente.
- **Corrección de cliente** (roles 1–4, motivo obligatorio) deja de ser un caso especial: un equipo en almacén no tiene cliente, así que "reasignarlo" es instalarlo en otro cliente. Para una instalación capturada en el cliente equivocado, el motor ofrece **corregir instalación**: cierra la versión actual (motivo "error de captura") y abre una en el cliente correcto. Lo transmitido antes queda con el cliente donde se generó (decisión del 30/10).

## 3. Instalaciones

- **Varias instalaciones activas por vehículo, una por clase de equipo.** Clase = AVL (GPS de vehículo y TrackGas), TRACKCAM, PANEL, RELOJ… (de `CatTipoDispositivo`). En la base: columna generada `ProductoActivoClase` + UNIQUE, igual que ya existe `DispositivoActivo` / `SimActivo`.
- **Toda vigencia que termina se archiva**, también la baja (hoy la baja solo pone `Estatus = 0` y se pierde el periodo). Reactivar = abrir una versión nueva.
- **Fecha real de instalación:** `VigenteDesde` corregible por roles 1–4 con motivo, solo hacia atrás y sin traslaparse con otra instalación del mismo equipo. Sirve para las **74 instalaciones migradas** cuyo equipo ya transmitía antes del alta en Next (fuente: fecha real del CRM o primera posición del equipo).
- **Geocercas:** hoy un cambio de componente las borra. Propuesta: que cuelguen del **vehículo** (`IdProducto`) y no de la versión de instalación; un cambio de equipo ya no las pierde.
- **Asignación de usuarios (7/9): se mantiene por instalación** (decisión del 30/10). El motor migra `UsuariosInstalaciones` en cada cambio de versión, en la misma transacción, como hoy. Un usuario asignado a la instalación de GPS no ve la de TrackCam del mismo vehículo si no se le asigna.

## 4. Historial de vida del activo

Tabla nueva `MovimientosRecurso`, escrita solo por el motor, en la misma transacción que el cambio:

| Columna | |
|---|---|
| `TipoRecurso` | dispositivo / sim / producto |
| `IdRecurso`, `Fecha` | |
| `EstatusAnterior`, `EstatusNuevo` | |
| `IdClienteAnterior`, `IdClienteNuevo` | |
| `IdInstalacion`, `IdOrdenServicio` | de dónde viene el movimiento |
| `Accion`, `Motivo`, `IdUsuario`, `Origen` | `Accion`: alta / instalacion / cambio / baja / reactivacion / estatus. `Motivo`: texto de quien hizo el cambio. `Origen`: api (front o App) / orden / sistema |

Con esto, `HistoricoInstalaciones` y la bitácora responden "qué pasó con la instalación"; `MovimientosRecurso` responde "**dónde ha estado este equipo**". Endpoint: `GET /dispositivos/:id/historial` (y SIM, producto).

## 5. El motor (`ActivosService`)

Un servicio con operaciones de negocio; los endpoints actuales (instalaciones, estatus de dispositivos/SIM/productos, cierre de órdenes, CRM) lo llaman en lugar de escribir directo:

| Operación | Qué hace |
|---|---|
| `instalar` | Valida componentes disponibles y clase libre en el vehículo; abre la versión; recursos → INSTALADO con el cliente |
| `cambiarComponente` | Archiva la versión con motivo; abre otra; el componente que sale → POR_REVISAR / LABORATORIO / INSERVIBLE |
| `desinstalar` | Archiva con motivo; recursos salen según el motivo y regresan a almacén (sin cliente) |
| `revisar`, `mandarALaboratorio`, `rehabilitar`, `declararInservible`, `inactivar`, `reactivar` | Transiciones de §1 |
| `corregirInstalacion` | Error de captura de cliente o vehículo (§2) |
| `corregirVigencia` | Fecha real de instalación (§3) |

Reglas comunes: transacción única, actualizaciones condicionales (`UPDATE … WHERE Estatus = esperado`; 0 filas → 409), alcance por usuario, movimiento en `MovimientosRecurso` y bitácora. Las órdenes de servicio ya llaman al servicio de instalaciones en su cierre: pasan a llamar al motor sin cambiar su contrato.

## 6. Posiciones por vigencia

- **Tramos:** cada versión de instalación (vigente e histórica) da un tramo `(IMEI del equipo, desde, hasta, IdProducto, IdCliente)`. Ya existe algo parecido en consola y en salidas de geocerca; se vuelve un helper único.
- **Histórico, reportes y última posición** consultan `Posiciones` por **IMEI + rango de fechas recortado a los tramos** del vehículo que el usuario puede ver. El índice actual `(Imei, FechaHora)` cubre la consulta.
- **No se agrega `IdInstalacion` a `Posiciones`:** calcular por tramos sigue siendo correcto aunque después se corrija una fecha de instalación, y no hay que migrar 1.7 M de filas.
- **Vehículo con GPS y TrackCam:** el histórico devuelve cada punto con su `fuente` (`avl` / `trackcam`). Por defecto el front muestra la del GPS y deja alternar. Las alertas de cada equipo siguen saliendo por su lado.
- **Orden de despliegue:** primero corregir `VigenteDesde` de las 74 instalaciones migradas, después activar el recorte. Si no, se ocultan recorridos reales.

## 7. Equipos que transmiten sin instalación

Hoy la ingesta solo acepta equipos en estatus 1 o 2; los demás van a `TelemetryHuerfanos` como "no registrado".

| Estatus del equipo | Propuesta |
|---|---|
| 2 INSTALADO | Normal |
| 1 DISPONIBLE | Se guarda (evidencia) y aparece en "equipos sin instalación" (roles 1–3): o se instaló sin dar de alta, o hay que revisarlo |
| 3 / 4 / 0 | Se guarda y se marca en "equipos sin instalación" con su estatus |
| 5 INSERVIBLE | Se guarda y **abre un incidente** (posible robo o vandalismo; decisión del 30/10) |
| No registrado | Igual que hoy (huérfanos) |

Así se cumple "nuestra responsabilidad es que el equipo transmita mientras no haya vandalismo": no se pierde ninguna transmisión y operación ve lo que no cuadra. Lo que se guarde sin instalación no lo ve ningún cliente (no cae en ningún tramo).

## 7b. Vigilancia de transmisión (requisito y definición del 30/10)

Todo equipo **instalado** debe transmitir. Si deja de hacerlo, **monitoreo se entera en el portal** y revisa con el cliente si es una falla, si el vehículo entró a taller, o si es algo imputable a un proveedor (telefonía, plataforma).

| Regla | Valor |
|---|---|
| Umbral sin transmitir | **Relojes: 24 h. Todos los demás equipos (GPS/AVL, TrackCam, paneles…): 12 h.** Configurable por tipo de equipo |
| Cuándo se evalúa | **Una vez al día, en horario diurno: entre las 9:00 y las 11:00** (hora de Ciudad de México). Corre a las 9:00 y, si el servidor no pudo, reintenta hasta las 11:00; fuera de esa ventana no se generan avisos |
| A quién | **Portal, a los operadores de monitoreo** (roles 4–5; administración también lo ve). No se notifica directo al cliente |
| Qué se genera | Un aviso por instalación en la bandeja "Sin transmisión", con última posición, horas sin transmitir, cliente, vehículo, equipo, SIM y compañía telefónica (para detectar fallas de un proveedor que afecten a varios equipos a la vez) |
| Atención | El operador registra el resultado: falla del equipo, taller (con fecha de regreso: se pausa la vigilancia de esa instalación), proveedor (telefonía/plataforma), cliente avisado, otro. Si vuelve a transmitir, el aviso se cierra solo |
| Agrupación por proveedor | Si en la misma evaluación varios equipos de la misma compañía telefónica dejan de transmitir, la bandeja los agrupa y lo marca como posible falla del proveedor |

- La fuente es `UltimaPosicion.FHRegistro` por equipo instalado. Ya existe la consulta de sin transmisión en consola; se reutiliza como tarea programada en NextAPI.
- La regla aplica por instalación. Un vehículo con GPS y TrackCam se vigila por cada equipo.
- **Equipos que nunca han transmitido** (hoy 238 de 407): van a una lista aparte "sin primera transmisión" y no generan avisos diarios hasta que operación los revise. Pueden ser instalaciones legadas que aún reportan a otro sistema.
- Un equipo **inservible que transmite** abre incidente (§7); eso es aparte de esta vigilancia.

## 8. Comandos de Next a los equipos (cola)

Hoy la cola va en un solo sentido (sockets → Next). La configuración que se captura en Next (`RelojConfig`) nunca llega al reloj.

- **Next:** tabla `ComandosDispositivo` (`Id`, `IdDispositivo`, `Tipo`, `Parametros`, `Estatus` pendiente/enviado/confirmado/fallido/vencido, `Intentos`, `IdUsuario`, fechas). Se publica en el exchange **`commands`** con routing key `<protocolo>.cmd` (outbox, igual que la ingesta).
- **Sockets** (kit compartido `springSocketKit`, se cambia una vez y se sincroniza a todos): consumidor que guarda el comando en su SQLite, lo manda cuando el equipo está conectado y publica la confirmación `<protocolo>.cmd.ack` con la respuesta del equipo.
- **Primer uso, reloj FA100S** (el protocolo lo permite):
  - **números de emergencia** `SOS1–3`, `CENTER` y agenda `PHB` (hasta 15);
  - **caída** con `FALLDOWN` (detección y llamada);
  - **sensibilidad** con `LSSET`;
  - intervalos.

  Catálogo en Next: números de emergencia del reloj por persona/instalación, con pantalla en el front.
- **Después:** parámetros de TrackCam (hoy por HTTP al gateway) y otros equipos, por el mismo canal.

## 9. Saneamiento de datos (script revisado antes de correr)

- 2 instalaciones activas cuyos componentes dicen "disponible", la SIM #3 "asignada" sin instalación, 3 instalaciones sin SIM (decidir si es válido).
- `VigenteDesde` de las 74 instalaciones migradas.
- Equipos disponibles → sin cliente.
- Productos "asignados" → activos.
- `MovimientosRecurso` inicial reconstruido desde el histórico.

## 10. Pruebas de punta a punta (`test/e2e-activos/`, misma infraestructura que órdenes)

1. **Ciclo completo:** alta del equipo (almacén, sin cliente) → instalar → cambio por orden de servicio → laboratorio → rehabilitar → instalar en otro cliente. El historial de vida está completo y cada cliente ve solo sus tramos.
2. **Vehículo con GPS y TrackCam:** se permite uno por clase y se rechaza un segundo GPS. El histórico trae ambas fuentes.
3. **Error de captura:** la instalación en el cliente equivocado se corrige; lo transmitido se queda con el cliente original.
4. **Visibilidad:** rol 6 con árbol de clientes, 7/9 asignados por vehículo, roles globales. Las posiciones anteriores o posteriores a una instalación no se ven.
5. **Fecha real:** se corrige hacia atrás y aparecen los recorridos migrados; no se acepta un traslape.
6. **Ingesta:** equipo en cada estatus transmitiendo (se guarda, se marca, alerta el inservible).
7. **Comandos:** números SOS al reloj con confirmación; reloj desconectado (queda pendiente y sale al reconectar); vencido.
8. **Concurrencia:** dos instalaciones del mismo equipo al mismo tiempo, y cambio de componente contra desinstalación.
9. **Esquema:** dump de producción + migraciones = entidades.

## 11. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| A ✅ | Catálogo de estatus, transiciones, `MovimientosRecurso`, motor sobre los endpoints existentes, baja archivada | — |
| B ✅ | Equipo sin cliente en almacén, FK simples en histórico y configuración, corregir instalación | A |
| C | Varias instalaciones por vehículo (por clase), geocercas y asignaciones por vehículo | A |
| D ✅ | Corregir `VigenteDesde` (74 migradas) y recorte por vigencia en histórico y reportes | A, saneamiento |
| E ✅ | Ingesta por estatus, panel de equipos sin instalación y vigilancia de transmisión (§7b) | A |
| F | Canal de comandos y números de emergencia del reloj | kit de sockets |

Cada fase cierra con unitarias, la batería, una revisión independiente, la documentación al día (incluidas `front-next.md` y `app-instaladores.md`) y comandos de despliegue.

## 12. Decisiones (30/10/2026)

1. Estatus del recurso: **3 = por revisar, 0 = inactivo administrativo**. ✅
2. Asignación de usuarios 7/9: **por instalación** (como hoy). ✅
3. Geocercas por vehículo: ✅
4. GPS + TrackCam: recorrido por defecto el del GPS. ✅
5. Inservible que transmite: **incidente**. Además, vigilancia de transmisión (§7b): relojes 24 h, demás 12 h; evaluación diaria entre 9:00 y 11:00; aviso en el portal a monitoreo. ✅
6. Corregir la fecha de instalación: **roles 1–4**. ✅


## 13. Fase A implementada (30/10/2026)

**Base:** `deploy/sql/MotorActivosFaseA.sql` crea `CatEstatusRecurso` (mismos números que ya usa `Estatus`: no hay migración de datos) y `MovimientosRecurso` (sin llaves foráneas: es evidencia).

**Código:**
- `src/motor-activos/estatus-recurso.ts`: reglas puras (transiciones, salida de una instalación, salida por baja), con pruebas unitarias.
- `src/motor-activos/motor-activos.service.ts`: `mover` (UPDATE condicional al estatus esperado; si otro proceso lo movió → 409; sincroniza `PanelAlarma`; escribe el movimiento en la misma transacción) y `cambiarEstatusManual`.
- Pasan por el motor:
  - los 10 `PATCH …/estatus/:id` de dispositivos, trackcam, relojes, paneles, SIM, productos, vehículos, personas, inmuebles y activos;
  - instalar, cambiar componente, baja y reactivación;
  - el cierre de órdenes de servicio, con `Origen = orden` e `IdOrdenServicio`;
  - el alta de dispositivos, productos y SIM, que registra su primer movimiento.
- Endpoints nuevos:
  - `GET /estatus-recurso`: catálogo con transiciones;
  - `GET /dispositivos|sims|productos/:id/historial`: roles 1–5 y 8.

**Cambios de comportamiento:**
- Dispositivo y SIM siguen la tabla de §1. Un cambio no permitido → 400, con los estatus permitidos en el mensaje.
- El componente que sale en un cambio va a 3, 4 o 5; antes aceptaba de 0 a 5. Lo mismo `estatusSalienteAnterior` de las órdenes.
- **Baja (0 o 5):**
  - archiva el periodo en `HistoricoInstalaciones` (`Accion = Baja`, `VigenteHasta`);
  - el dispositivo va a 3, o a 5 si la baja es 5;
  - la SIM va a 3 y el producto a 1. Antes los tres regresaban a 1.
- **Reactivar:**
  - exige los componentes en 1 (revisados);
  - pone `VigenteDesde` = ahora y enlaza el eslabón a la baja;
  - rechaza una instalación que ya está activa o ya está dada de baja.
  - Una baja anterior al motor no tiene archivo: al reactivarla se conserva su `VigenteDesde`, como antes. El saneamiento (§9) reconstruye ese periodo.
- Una baja como inactiva (0) se puede corregir a inservible (5); el equipo, si sigue por revisar, pasa a 5.
- El cambio de cliente de un dispositivo o una SIM solo procede en 0 o 1, y queda en el historial como `traspaso`.
- Las ediciones de ficha ya no reescriben `Estatus` con el valor leído al inicio (`sinEstatus`). `PanelAlarma.Estatus` sigue en 1 mientras el panel está instalado.
- Reportes por instalación (`resolverDispositivosEnPeriodo`): una instalación dada de baja con el motor ya no aporta un tramo abierto; empieza en su baja archivada.
- El producto conserva su escala hasta la fase C. Ya no se le puede poner 2 al salir de un cambio.

**Pendiente para el saneamiento (§9), antes o junto con el despliegue:**
- Las instalaciones activas cuyo producto, equipo o SIM no esté en 2 (el diagnóstico encontró #1000001 y #1000002). Un cambio o baja sobre ellas responde 409, con el estatus encontrado y el esperado, hasta corregirlas.
- Reconstruir el periodo de las bajas anteriores al motor.

**Revisión independiente (30/10):** se corrigió todo lo que encontró:
- sincronización de `PanelAlarma`;
- reportes después de una baja;
- reactivación de bajas anteriores al motor;
- traspaso de SIM y cambio de cliente de dispositivo fuera del motor;
- ediciones que podían revertir un estatus;
- validación de `estatusSalienteAnterior` en el DTO;
- código muerto.

Queda la ruta `sims/:id/historial`, que depende de registrar `MotorActivosModule` antes que `SimsModule` porque existe `sims/:page/:limit`. Está anotado en `app.module.ts` y lo cubre la batería.

**Pruebas:** `test/e2e-ordenes/activos.e2e-spec.ts` cubre el catálogo, el alta, el ciclo completo, la baja, la reactivación, el inservible, la concurrencia, el permiso del historial y el origen "orden". Usa la misma infraestructura que órdenes (`npm run test:e2e-ordenes`).


## 14. Fase D implementada (30/10/2026)

**Base:**
- `deploy/sql/MotorActivosFaseD.sql` crea `CorreccionesInstalacion` (evidencia de correcciones que no abren versión: campo, valor anterior y nuevo, motivo, usuario, origen).
- `deploy/sql/SaneamientoFaseD.sql` corrige `VigenteDesde` de las migradas. Se corre **antes** de desplegar el código: si no, el recorte oculta recorridos reales.

**Lo que mostró producción (30/10):** de las instalaciones activas con posiciones anteriores a su `VigenteDesde`, casi todas tienen de 1 a 6 posiciones minutos antes del alta: es la prueba del instalador. Pocas tienen horas (p. ej. #1000214 con 368 posiciones 18 h antes, #1000094 con 172 posiciones 8 h antes) y dos tienen versión anterior (#1000031 y #1000036).

**Saneamiento:**
- Primero archiva las bajas anteriores al motor.
- Lleva `VigenteDesde` a la primera posición del equipo **solo** si la instalación no tiene versión anterior, su dispositivo y su SIM no tienen otro periodo (ni histórico ni otra instalación) y la primera posición es de a lo más 2 días antes del alta (más atrás puede ser almacén o banco de pruebas).
- Cada corrección queda en `CorreccionesInstalacion` con `Origen = sistema`. Es idempotente.
- Lista las que se movieron más de 30 min y las activas que quedan con posiciones previas, para revisarlas a mano con el endpoint.

**Tramos** (`src/motor-activos/tramos-instalacion.ts`, puras; `TramosInstalacionService`, carga):
- Cada versión de la instalación aporta `(IMEI, desde, hasta)`: la vigente (abierta) y la cadena archivada por `IdHistoricoInstalacion`, en lote (una consulta por nivel).
- Dada de baja con el motor: su último periodo es la baja archivada. Una baja anterior al motor la archiva el saneamiento (fin = `FechaActualizacion`, antes de que otra escritura la mueva); la reactivación y la corrección a inservible la archivan también si quedara alguna.
- Solo versiones del mismo cliente que la instalación: lo transmitido se queda con el cliente donde se generó.
- Intervalos semiabiertos `[desde, hasta)`: en el segundo de un cambio la posición es de la versión que empieza. La condición SQL es `(Imei = ? AND FechaHora >= ? AND FechaHora < ?) OR …`, sin `CAST`, para usar `IX_Posiciones_Imei_Fecha`.

**Dónde se aplica:**
- Histórico de monitoreo: cada equipo que tuvo la unidad, solo en su tramo. Antes solo el equipo actual y sin recorte.
- Reportes (posiciones, última posición, paso por POI, velocidad, distancia, salidas de geocerca por cliente y por instalación): una candidata por tramo, también de las instalaciones dadas de baja. Distancia da un recorrido por equipo; la posición previa de geocercas no sale del tramo; un tramo de otro producto lleva la etiqueta de ese producto.
- Consola (transmisiones, galería, resumen): tramos en lugar del límite inferior único; cada foto se atribuye a la instalación dueña en esa fecha.
- Última posición (monitoreo, consola, sin transmisión, productos del cliente, dashboard): se ignora si es anterior al `VigenteDesde` actual.
- Dashboard (alertas y excesos de 7 días): desde el `VigenteDesde` actual. Un equipo que salió de la unidad dentro de la ventana no se cuenta; los roles globales cuentan toda la flota.
- Incidentes: una posición fuera de todo tramo → 400; el cliente del incidente es el de la instalación dueña de la posición.

**Endpoint:** `PATCH /instalaciones/:id/vigente-desde` (roles 1–4, motivo obligatorio): solo hacia atrás, no futura, solo activas; sin traslape con la versión anterior ni con otro periodo del mismo dispositivo o SIM. Bloquea la fila y escribe condicional a la fecha leída (409 si cambió); el cambio de componente y la baja también bloquean la fila.

Los incidentes automáticos toman el cliente de la instalación activa desde la fase E (§15).

**Pruebas:** `test/e2e-ordenes/vigencia.e2e-spec.ts` (corrección, traslapes, roles, cambio de equipo en histórico y distancia, última posición, consola, incidentes y el script de saneamiento) y unitarias de tramos.


## 15. Fase E implementada (30/10/2026)

**Base:** `deploy/sql/MotorActivosFaseE.sql` crea `VigilanciaTransmisionTipo` (umbral por tipo de equipo; reloj = 24 h, el resto 12 h por omisión), `EvaluacionesTransmision` (una fila por día: candado de la evaluación diaria) y `AvisosSinTransmision` (bandeja).

**Ingesta por estatus (§7):**
- La búsqueda del equipo acepta cualquier estatus (antes solo 1 y 2) y devuelve el estatus. Un número de serie o IMEI desconocido sigue yendo a huérfanos.
- La posición siempre se guarda. **Sin instalación activa no abre incidentes**: es evidencia y ningún cliente la ve (queda fuera de todo tramo).
- La búsqueda tiene caché de 10 min: si llega una alerta de un equipo que la caché da por no instalado, se confirma en la base (solo en ese caso), para no perder la alerta de un equipo recién instalado.
- Los incidentes automáticos van al cliente de la **instalación activa** del equipo, no al cliente del dispositivo.
- **Inservible (5) que transmite:** un incidente abierto por equipo (`DatosOrigen.alerta = inservible_transmite`), en el **cliente raíz** (la operación): lo atiende monitoreo, no el cliente final. Trae el cliente dueño del equipo. Sin cliente raíz no se abre (no cae al cliente dueño).
  - No se duplica mientras siga abierto (candado de MySQL por IMEI entre instancias) y, ya cerrado, no se vuelve a abrir en 24 h aunque siga transmitiendo.
  - No se mezcla con las alertas de consola. Una memoria de 10 min evita consultar en cada posición.
- Paneles: sus eventos ya se guardaban aunque el panel no estuviera dado de alta (`EventoAlarma.Estatus = 0`); el incidente de panel inservible no está cubierto.

**Equipos sin instalación:** `GET /dispositivos/sin-instalacion` (roles 1–3; `desde`, `estatus`): equipos con transmisión reciente y sin instalación activa, con su estatus y la última instalación de la que salieron.

**Vigilancia de transmisión (§7b)**, módulo `src/vigilancia-transmision/`:
- Última transmisión: `UltimaPosicion.FHRegistro` (o `FechaHora`) si es de la vigencia actual (`FechaHora >= VigenteDesde`); paneles, `PanelAlarma.UltimoHeartbeat`. Nada en la vigencia → lista "sin primera transmisión", sin aviso.
- Cada 10 min: cierra los avisos resueltos (`transmitio`, `baja`, o `cambio` si la versión de la instalación ya no existe). Entre 9:00 y 11:00 (CDMX) evalúa una vez al día; el candado es la fila del día en `EvaluacionesTransmision`, así que reinicios o dos instancias no la repiten. Si una corrida no terminó (falla o reinicio), se retoma pasados 15 min dentro de la ventana.
- Una evaluación manual cuenta como la del día: si se corre a las 8:00, la de las 9:00 ya no corre.
- Un aviso vivo por instalación (UNIQUE sobre una columna generada): cada evaluación lo actualiza. Resultado `taller` con fecha de regreso pausa la vigilancia de esa instalación hasta esa fecha; pasada, si sigue sin transmitir, el aviso vuelve a abierto.
- Atender un aviso que se cerró solo en ese momento → 409.
- La bandeja agrupa por compañía telefónica y marca posible falla del proveedor con `VIGILANCIA_PROVEEDOR_MIN` (3) o más avisos de la misma compañía **abiertos en la misma evaluación** (`FechaPrimeraEvaluacion`): equipos que llevan semanas sin transmitir por causas distintas no la disparan.
- Los cerrados, sin `fecha`, son los de los últimos 30 días.
- Endpoints: `GET /vigilancia-transmision/avisos`, `GET /vigilancia-transmision/sin-primera-transmision`, `PATCH /vigilancia-transmision/avisos/:id/atender` (roles 1–5) y `POST /vigilancia-transmision/evaluar` (roles 1–2, manual; 409 si ya corrió hoy salvo `forzar`). `VIGILANCIA_TRANSMISION_ENABLED=false` apaga el programador.
- Sin push por WebSocket: el portal consulta la bandeja.

**Pruebas:** `test/e2e-ordenes/ingesta.e2e-spec.ts` y `vigilancia.e2e-spec.ts`, más unitarias de las reglas de vigilancia.


## 16. Fase B implementada (30/10/2026)

**Decisión del 30/10:** sin cliente = almacén general, con **reserva opcional** a un cliente (como hoy: operación puede apartar inventario antes de ir a campo). En el saneamiento lo que no está instalado pasa al almacén.

**Base** (`deploy/sql/MotorActivosFaseB.sql`, una vez; quita columnas que usa el código anterior: compilar, aplicar y reiniciar enseguida):
- `Dispositivos.IdCliente` y `Sims.IdCliente` admiten NULL.
- `Instalaciones`: FK simples por `IdDispositivo` / `IdSim`, y compuestas `(IdCliente, DispositivoActivo)` / `(IdCliente, SimActivo)`: el amarre al cliente solo vale para la versión activa.
- `HistoricoInstalaciones`: FK simples a dispositivo, SIM y producto; su `IdCliente` es el del periodo.
- `RelojConfig`, `TrackcamConfig`, `PanelAlarma`: sin `IdCliente`; FK simple al dispositivo.
- `deploy/sql/SaneamientoFaseB.sql`: lo que no tiene instalación activa pasa al almacén (movimiento `traspaso`, origen sistema, con el cliente que tenía); un equipo o SIM en 2 sin instalación pasa a 3.

**Reglas:**
- Alta: sin `idCliente` entra al almacén (solo roles 1–5 y 8); con él, reservado.
- Reservar (`PATCH /dispositivos/:id` o `/sims/:id` con `idCliente`): disponible o inactivo; `null` lo regresa al almacén (solo operación). Instalado no cambia de cliente. Ya no hay "traspaso" que clone la SIM: el historial apunta por Id.
- Instalar: del almacén o reservado a ese cliente, disponible y sin otra instalación activa en ningún cliente. El motor le pone el cliente antes de escribir la versión activa (`tomarParaInstalar`, condicional: 409 si otro proceso lo tomó). Al salir (baja, cambio de componente) regresa al almacén en el mismo movimiento.
- Visibilidad: lo del almacén solo lo ven los roles sin filtro de cliente; los selectores con `idCliente` traen lo reservado a él más el almacén para operación.
- La configuración (panel, TrackCam, reloj) es del equipo: los listados y joins van por el dispositivo. El cliente de un evento de panel es el de su instalación activa.
- TrackCam: el registro en el gateway se reenvía cuando instalar, desinstalar o corregir le cambia el cliente (`tenantId` 0 en almacén). Al cerrar una orden se emite después del commit.

**Corregir instalación:** `PATCH /instalaciones/:id/corregir-cliente` (roles 1–4; `idCliente`, `idProducto` del cliente correcto, `motivo`). Cierra el periodo en el cliente equivocado (baja archivada con el motivo; su vehículo a activo; geocercas fuera), pasa equipo y SIM al cliente correcto sin desinstalarlos y abre una instalación nueva allí. Lo transmitido antes se queda con el cliente original. Queda en `CorreccionesInstalacion` y en el historial de cada recurso.

**Revisión independiente (30/10):**
- Un usuario de cliente no toma equipo ni SIM del almacén al instalar, cambiar componente o reactivar: solo lo reservado a su cliente; el almacén es de los roles sin filtro (y de las llamadas internas, como el cierre de órdenes).
- Las ediciones de ficha de dispositivo ya no reescriben `IdCliente` con el valor leído (`sinEstatusNiCliente`).
- Una reserva se suelta (regresa al almacén) si el equipo o la SIM pasa a por revisar, laboratorio o inservible.
- El registro de TrackCam también se reenvía al reservar o regresar al almacén a mano; `POST /dispositivos/trackcam/registro/sincronizar` (roles 1–2) reenvía todas, para después del saneamiento.
- Corregir instalación no procede con una orden de servicio abierta sobre ella.
- El saneamiento conviene correrlo con poco tráfico: si una instalación entra en medio, la transacción se revierte completa.

**Pruebas:** `test/e2e-ordenes/almacen.e2e-spec.ts` (alta en almacén, selector, instalar/desinstalar, reserva, reactivación, corregir instalación y saneamiento) y la batería completa con el esquema nuevo. También el cambio de equipo, el usuario de cliente con el almacén y la reserva que se suelta.

# Motor de activos y visibilidad (diseño para revisión)

**Estado:** propuesta del 30/10/2026, para revisar con Israel **antes** de implementar. Parte del diagnóstico ([diagnostico-modelo.md](diagnostico-modelo.md)).

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
- **Fecha real de instalación:** `VigenteDesde` corregible por roles 1–3 con motivo, solo hacia atrás y sin traslaparse con otra instalación del mismo equipo. Sirve para las **74 instalaciones migradas** cuyo equipo ya transmitía antes del alta en Next (fuente: fecha real del CRM o primera posición del equipo).
- **Geocercas:** hoy un cambio de componente las borra. Propuesta: que cuelguen del **vehículo** (`IdProducto`) y no de la versión de instalación; un cambio de equipo ya no las pierde.
- **Asignación de usuarios (7/9):** hoy `UsuariosInstalaciones` se migra en cada cambio de versión. Propuesta: asignar por **vehículo** (`IdProducto`); el usuario ve todas las instalaciones (GPS y TrackCam) de los vehículos asignados.

## 4. Historial de vida del activo

Tabla nueva `MovimientosRecurso`, escrita solo por el motor, en la misma transacción que el cambio:

| Columna | |
|---|---|
| `TipoRecurso` | dispositivo / sim / producto |
| `IdRecurso`, `Fecha` | |
| `EstatusAnterior`, `EstatusNuevo` | |
| `IdClienteAnterior`, `IdClienteNuevo` | |
| `IdInstalacion`, `IdOrdenServicio` | de dónde viene el movimiento |
| `Motivo`, `Comentario`, `IdUsuario`, `Origen` | front / app / crm / orden / sistema |

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
| 5 INSERVIBLE | Se guarda y **alerta** a operación: un equipo dado de baja que transmite es posible robo o vandalismo |
| No registrado | Igual que hoy (huérfanos) |

Así se cumple "nuestra responsabilidad es que el equipo transmita mientras no haya vandalismo": no se pierde ninguna transmisión y operación ve lo que no cuadra. Lo que se guarde sin instalación no lo ve ningún cliente (no cae en ningún tramo).

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
| A | Catálogo de estatus, transiciones, `MovimientosRecurso`, motor sobre los endpoints existentes, baja archivada | — |
| B | Equipo sin cliente en almacén, FK simples en histórico y configuración, corregir instalación | A |
| C | Varias instalaciones por vehículo (por clase), geocercas y asignaciones por vehículo | A |
| D | Corregir `VigenteDesde` (74 migradas) y recorte por vigencia en histórico y reportes | A, saneamiento |
| E | Ingesta por estatus y panel de equipos sin instalación | A |
| F | Canal de comandos y números de emergencia del reloj | kit de sockets |

Cada fase cierra con unitarias, la batería, una revisión independiente, la documentación al día (incluidas `front-next.md` y `app-instaladores.md`) y comandos de despliegue.

## 12. Decisiones que necesito

1. **Estatus del recurso (§1):** ¿de acuerdo con reinterpretar el 3 como "por revisar" (unifica con la SIM) y el 0 como "inactivo administrativo"?
2. **Asignación de usuarios 7/9 por vehículo** en lugar de por instalación (§3): ¿de acuerdo?
3. **Geocercas por vehículo** (§3): ¿de acuerdo con que un cambio de equipo ya no las borre?
4. **GPS + TrackCam (§6):** ¿el recorrido por defecto es el del GPS?
5. **Inservible que transmite (§7):** ¿alerta a operación como incidente o solo como aviso en el panel?
6. **Corregir la fecha de instalación** (§3): ¿roles 1–3, o también el 4?

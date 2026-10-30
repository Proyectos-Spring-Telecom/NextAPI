# Diagnóstico del modelo de Next (fase 0)

**Fecha:** 30/10/2026 · **Alcance:** esquema de producción (dump del 29/10 + `deploy/sql`), código de `dev-isra` (`ed3caf5`) y datos reales de producción (solo lectura). Base para el diseño del motor de activos y visibilidad.

**Objetivo de fondo:** Next es la fuente de verdad. Las posiciones de un vehículo son las de su dispositivo **desde que se instaló hasta que se desinstaló**, y cada usuario ve solo lo que le corresponde en su organización, aunque después cambien las combinaciones de vehículo, dispositivo, SIM, cliente y usuario. La evidencia (lo que ya transmitió) no se mueve ni se borra.

## 1. Veredicto

El núcleo de inventario es **más relacional de lo habitual**. La integridad de **la telemetría y de quién ve qué** depende del código, y el código tiene huecos.

**Lo que la base ya garantiza:**
- **FK compuestas `(IdCliente, Id)`**: producto, dispositivo, SIM e instalación son siempre del mismo cliente.
- **Columnas generadas `DispositivoActivo` / `SimActivo` con UNIQUE**: un equipo o SIM no puede estar en dos instalaciones activas.
- **UNIQUE** en IMEI, número de serie, ICCID, RFC y placa por cliente.
- **Historial encadenado** de versiones de instalación con `VigenteDesde` / `VigenteHasta`.
- Todo InnoDB, utf8mb4 y una sola collation (salvo `RefreshSessions`).

**Lo que la base no garantiza:**
- Posiciones, fotos y videos ligados solo por IMEI, sin FK.
- Órdenes de servicio sin FK salvo el cliente.
- Estatus sin CHECK.
- Login global por `UserName` con UNIQUE solo por cliente.
- Ciclos posibles en el árbol de clientes.

## 2. Datos reales (producción, 30/10/2026)

| Qué | Resultado |
|---|---|
| Duplicados de IMEI, número de serie o ICCID | 0 |
| Equipo, SIM o producto en dos instalaciones activas | 0 |
| Instalación activa con componentes de otro cliente | 0 |
| Instalaciones activas con dispositivo y producto en estatus 1 (deberían ser 2) | 2 (#1000001 y #1000002, cliente 13, sin SIM) |
| Instalaciones activas sin SIM | 3 |
| SIM en estatus 2 sin instalación | 1 (#3) |
| Teléfonos de SIM repetidos | 3 |
| Dispositivos sin IMEI | 2 |
| **Instalaciones activas que nunca han transmitido a Next** (sin `UltimaPosicion`) | **238 de 407** |
| Posiciones | 1.74 M desde el 31/08/2026, de 173 IMEI, todos registrados |
| **IMEI con posiciones anteriores a la `VigenteDesde` de su instalación y sin versión previa** | **74**: instalaciones migradas que se dieron de alta en Next después de que el equipo ya transmitía |
| Equipos transmitiendo **sin instalación activa** | 4: uno en estatus 5 (inservible) con 5,454 posiciones y tres disponibles (1) con 2,944 |
| Bajas registradas en el histórico | 0: las 16 filas del histórico son cambios de equipo, SIM o producto; la baja se hace en la misma fila, sin `VigenteHasta` |
| Árbol de clientes | 1 raíz, 39 hijos, sin padres inexistentes |
| Usuarios | 58: rol 6 = 43, rol 7 = 5, rol 5 = 3, roles 1–2 = 3, rol 4 = 1, rol 8 = 2, rol 9 = 1 |
| `UsuariosInstalaciones` | 1,297 asignaciones de 11 usuarios |

**Consecuencia para el diseño:** recortar el histórico por vigencia sin corregir antes la `VigenteDesde` de las 74 instalaciones migradas **ocultaría recorridos legítimos**. Primero hay que fijar la fecha real de instalación (la del CRM o la primera posición) y después recortar.

## 3. Quién ve qué (como está implementado)

**Clientes:** árbol con `IdPadre`. `spGetClientes` devuelve un cliente y sus descendientes.

**Roles:** no hay árbol de roles; el alcance sale del rol (`tenant-filter.service.ts`).

| Rol | Ve |
|---|---|
| 1, 2, 3, 4, 5, 8 | Todos los clientes, aunque el usuario sea de un cliente final |
| 6 (cliente) | Su cliente y sus descendientes |
| 7 (operador), 9 (usuario) | Su cliente; en monitoreo, consola y dashboard **solo las unidades asignadas** en `UsuariosInstalaciones` |

**Permisos:** existen `Permisos`, `Modulos` y `UsuariosPermisos`, pero **solo se devuelven en `/login/me` para pintar el menú**. Ningún guard los valida en el servidor. No hay `RolesPermisos`.

Hay dos definiciones de "global" en el código: `ROLES_ACCESO_GLOBAL = [1, 2]` y `ROLES_SIN_FILTRO`. `@Roles()` vacío deja pasar a cualquier rol (39 controladores).

## 4. Fugas y escaladas confirmadas en el código

| # | Gravedad | Endpoint | Problema |
|---|---|---|---|
| F1 | **Crítica** | `PATCH /clientes/:id` (y `GET /clientes/:id`) | Sin alcance y para cualquier rol. Acepta `idPadre`: un usuario puede colgar cualquier cliente bajo el suyo y **ganar visibilidad sobre él**, o crear un ciclo |
| F2 | **Alta** | `GET /monitoreo/:idInstalacion/historico` | Sin alcance: cualquier usuario con sesión ve el recorrido de cualquier instalación. Además busca solo por IMEI y fechas, sin vigencia: muestra posiciones de cuando el equipo estaba en otro vehículo o cliente |
| F3 | Alta | `POST /monitoreo/:idInstalacion/foto` y `/video` | Sin alcance (solo el guard del gateway) |
| F4 | Alta | `GET /dispositivos/:id` y los 12 `PATCH …/estatus/:id` (dispositivos, trackcam, relojes, paneles, SIM, productos y subtipos) | Lectura y escritura entre clientes, sin restricción de rol. El PATCH permite poner 2 (asignado) a mano |
| F5 | Alta | Reportes (paso por POI, velocidad, posiciones, última posición, distancia, salidas de geocerca), incidentes y alarmas | Validan el cliente pero **ignoran `UsuariosInstalaciones`**: un rol 7/9 ve todas las unidades de su cliente. Los reportes además filtran sin vigencia |

**Estado (30/10/2026):** F1–F5 corregidas en alcance (cliente según el rol; 7/9 solo lo asignado; fuera de alcance → 404). El cliente padre solo lo cambian los roles 1–3 y sin ciclos. "Asignado" (2) ya no se pone a mano. Prueba: `test/e2e-ordenes/acceso.e2e-spec.ts`. **Pendiente:** recortar el histórico y los reportes por vigencia, que va con el motor (§2).

**Bien filtrado:** `/monitoreo/list`, `/consola` (galería, transmisiones, sin transmisión; con recorte por vigencia), socket de monitoreo, dashboard y geocercas.

## 5. Ciclo de vida de los activos (como está)

- **Estatus de Productos, Dispositivos y SIM (columna `Estatus`, sin catálogo en la base):** 0 inactivo, 1 disponible, 2 asignado, 3 baja por reemplazo, 4 baja por mantenimiento, 5 inservible. En el enum de SIM, el 3 se llama "revisión".
- **`CatEstatusInstalacion`** repite la escala para la instalación. El 2 (asignada) no se usa: las instalaciones son 1 activas o 0/5 dadas de baja.
- **El dispositivo no puede estar sin cliente** (`IdCliente` NOT NULL). Un equipo disponible pertenece siempre a algún cliente, y cambiarlo está bloqueado si ya estuvo instalado.
- **Cambio de equipo, SIM o producto:** archiva la versión con `VigenteDesde`/`VigenteHasta`, crea la instalación con **Id nuevo**, migra `UsuariosInstalaciones` y **borra las geocercas**. La identidad estable del vehículo es `IdProducto`, no `IdInstalacion`.
- **Baja:** se hace en la misma fila (`Estatus = 0`), sin histórico ni `VigenteHasta`. Si se reactiva, el hueco se pierde.
- **Un vehículo con dos equipos (GPS y TrackCam):** hoy no se puede. Al instalar se exige que el producto esté disponible (1), y la base tampoco lo contempla.

## 6. Riesgos de integridad en la base

| # | Prioridad | Riesgo | Arreglo |
|---|---|---|---|
| 1 | Media | Login por `UserName` con UNIQUE solo `(IdCliente, UserName)` | `UNIQUE(UserName)` |
| 2 | Media | La baja no queda en el histórico | Archivar también en la baja (o `VigenteHasta` en Instalaciones) |
| 3 | Media | `UsuariosInstalaciones` sin UNIQUE ni amarre de cliente | `UNIQUE(IdUsuario, IdInstalacion)` y cliente coherente |
| 4 | Media | `Estatus` vs `EstatusInstalacion` y estatus de componentes pueden divergir (ya hay 2 casos) | CHECK de coherencia y de rango; transiciones en un solo servicio |
| 5 | Media | Órdenes de servicio sin FK salvo cliente | FK compuestas a producto, dispositivo, SIM; técnico a Usuarios |
| 6 | Media | Ciclos posibles en `Clientes.IdPadre` | Validar en código y con trigger |
| 7 | Baja | `Posiciones.Id` es INT (1.7 M de 2,147 M) | Migrar a BIGINT antes de que crezca |
| 8 | Baja | ICCID en una columna llamada `IMEI`, índice duplicado, `UltimoEventoAlarma.IdPanel` apunta a `Dispositivos` | Renombrar, limpiar, apuntar a `PanelAlarma` |

## 7. Siguiente paso

1. ✅ **Fugas F1–F5 cerradas en alcance** (cliente, rol y unidades asignadas), con pruebas de punta a punta. El recorte por vigencia va en el motor (punto 3), por lo de §2.
2. **Corregir los datos inconsistentes de §2** con un script revisado.
3. **Diseño del motor de activos y visibilidad**, para revisarlo antes de implementar:
   - catálogo de estatus de recursos y transiciones;
   - dispositivo disponible sin cliente;
   - historial de vida del activo;
   - corrección de cliente para roles 1–4;
   - vigencia de posiciones por instalación;
   - comandos de Next a los sockets (configuración del reloj, números de emergencia);
   - qué hacer con equipos que transmiten sin instalación.

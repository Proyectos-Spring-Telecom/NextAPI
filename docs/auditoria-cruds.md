# Auditoría de CRUDs (30/10/2026)

A pedido de los equipos de la App (Andrea) y del front (Lalo): "muchos CRUDs con métodos incompletos". Revisión de 45 controladores con sus servicios, en `dev-isra` (`be803b5`).

**Conclusión:** en casi todos los recursos los métodos existen. Lo que falla es:
- **el alcance por cliente está a medias**: hay tres generaciones de código, y algunas permiten ver o editar lo ajeno o impiden a administración editar lo de un cliente hijo;
- **cada familia de recursos sigue su propia convención** de rutas, paginación, estatus y respuesta;
- **faltan algunos catálogos y lecturas** que el front necesita.

## 1. Matriz

✅ completo · ❌ falta · ⚠️ incompleto. **Pág** = lista paginada. **Est** = cambio de estatus.

| Recurso | List | Pág | Detalle | Crear | Editar | Est | Borrar | Extra |
|---|---|---|---|---|---|---|---|---|
| productos (raíz) | ✅ | ✅ `paginado/` | ⚠️ sin alcance | ❌ (por subtipo) | ⚠️ solo cliente del token | ✅ | ❌ | `cliente/:id` |
| vehiculos | ⚠️ solo activos | ✅ | ⚠️ sin alcance | ⚠️ cliente sin validar | ⚠️ **sin alcance** | ✅ | ❌ | `placa/:placa` |
| activos / personas / inmuebles | ⚠️ todos los estatus | ✅ | ⚠️ sin alcance | ⚠️ cliente sin validar | ⚠️ solo cliente del token | ✅ | ❌ | — |
| dispositivos (raíz) | ✅ | ✅ `paginado/` | ✅ | ⚠️ cliente sin validar | ✅ | ✅ | ❌ | `cliente/:id` |
| trackcam / relojes / paneles | ⚠️ todos los estatus | ✅ | ⚠️ sin alcance | ⚠️ cliente sin validar | ⚠️ solo cliente del token | ✅ | ❌ | paneles: ❌ usuarios del panel |
| sims | ⚠️ solo disponibles | ✅ | ⚠️ sin alcance ni relaciones | ⚠️ cliente sin validar | ✅ | ✅ | ❌ | — |
| instalaciones | ✅ | ⚠️ `POST paginado` | ✅ | ⚠️ cliente sin validar | ✅ | ✅ (0/1/5) | ❌ | `historico/:id` |
| clientes | ✅ | ✅ | ✅ | ⚠️ cualquier rol | ✅ | ✅ toggle | ❌ | ⚠️ `list/:cliente` sin alcance |
| usuarios | ✅ | ✅ | ✅ | ⚠️ **escalada de rol** | ⚠️ **sin alcance** | ⚠️ sin alcance | ❌ | asignación, NIP, rostro |
| operadores | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | licencias sin `GET` |
| incidentes, geocercas, puntos de interés, números de emergencia | ✅ | ✅ `?page` | ✅ | ✅ | ✅ | ✅ | geocercas ✅ | — |
| ordenes-servicio | — | ⚠️ sin `totalPages` | ✅ | ✅ | ✅ | flujo | (cancelar) | flujo completo |
| roles, módulos, permisos | ✅ | ✅ | ✅ | ✅ rol 1 | ⚠️ `PUT` | ⚠️ módulos/permisos `:id/estatus` | ❌ | — |
| catálogos de marcas, modelos, combustible, telefonía, planes | ✅ | ⚠️ telefonía con otro formato | ✅ | ⚠️ cualquier rol | ⚠️ cualquier rol | ✅ | ❌ | — |

**Sin endpoint:**
- `CatTipoDispositivo`, `CatTipoProducto`, `CatEstatusInstalacion` y `CatProductos`. Son los selects del front.
- `UsuarioPanelAlarma`.
- La lectura de `UsuariosPermisos` / `AsignacionSoluciones` sin traer el usuario completo.

## 2. Huecos

**Alta (seguridad o bloquean flujos):**

| # | Hueco | Dónde |
|---|---|---|
| C1 | **Escalada de rol:** al crear o editar un usuario solo se limita a los roles 6 y 9. Cualquier otro rol (4, 5, 7, 8) puede crear o promover a rol 1. La edición y el estatus de usuarios no validan el cliente | `usuarios.service.ts:855-885`, `:1207`, `:1345` |
| C2 | `PATCH /productos/vehiculos/:id` sin alcance; la placa única se valida contra el cliente del token y no contra el del vehículo | `vehiculos.service.ts:611-625` |
| C3 | Detalle sin alcance (se ve lo ajeno) | `findOne` de activos, personas, inmuebles, vehículos, productos, paneles, relojes, trackcam y SIM |
| C4 | Editar busca por el cliente del token: **administración y clientes padre reciben 404** al editar lo de un cliente hijo | `update` de activos, personas, inmuebles, productos, paneles, relojes, trackcam |
| C5 | Altas sin validar que el cliente destino esté en el alcance de quien crea | subtipos de producto y dispositivo, SIM, instalaciones; `POST /clientes` con `@Roles()` vacío y cualquier `idPadre` |
| C6 | `GET /clientes/list/:cliente` devuelve la jerarquía de cualquier cliente | `clientes.service.ts:420` |
| C7 | `GET /sims/:id` no trae lo que Swagger promete (cliente, telefonía, plan) | `sims.service.ts:282` |

**Media:**
- Catálogos de tipos que faltan (§1).
- Catálogos sin control de rol (un rol 9 puede crear marcas).
- `GET list` que filtra distinto en recursos hermanos (el front no lo puede usar para "disponibles").
- Paginación con otro formato (telefonía, órdenes sin `totalPages`).
- Sin búsqueda por texto en los paginados.
- Licencias de operadores sin `GET`.
- Usuarios del panel de alarma sin endpoint.
- Swagger que contradice al código en estatus.

**Baja:**
- El nombre de productos no se propaga a los subtipos.
- `createCliente` devuelve el id como texto.
- La bitácora tiene una ruta obsoleta todavía publicada.
- El rol 3 puede editar el rol SA.

## 3. Convenciones distintas

| Tema | Variantes |
|---|---|
| Paginación | `:page/:limit` · `paginado/:page/:limit` · `?page&limit` · `POST paginado` |
| Ruta de estatus | `estatus/:id` · `:id/estatus` |
| Semántica de estatus | Estatus destino en el body (recursos) · alterna 1↔0 sin body (el resto) |
| Editar | `PATCH` · `PUT` (roles, módulos, permisos) |
| Respuesta | `{ data }` en lecturas · `{ status, message, data: { id, nombre } }` en escrituras, salvo excepciones |
| Alcance | Tres generaciones: `idsClientePermitidos` / `assertClienteVisible` / cliente del token o nada |

## 4. Contrato estándar propuesto

| Operación | Ruta | Respuesta |
|---|---|---|
| Lista para selects | `GET /{r}/list?estatus=&idCliente=` | `{ data }`; por defecto activos/disponibles, `estatus=all` todos |
| Paginado | `GET /{r}?page=&limit=&q=&idCliente=&estatus=&orden=` | `{ data, paginated: { total, page, limit, totalPages } }`, `limit` ≤ 200 |
| Detalle | `GET /{r}/:id` | `{ data }` con relaciones planas |
| Crear | `POST /{r}` | 201 `{ status, message, data: { id: number, nombre } }` |
| Editar | `PATCH /{r}/:id` (sin `PUT`) | 200, misma forma |
| Estatus | `PATCH /{r}/estatus/:id` con `{ estatus }` explícito (sin toggle); recursos de inventario por el motor ([motor-activos.md](motor-activos.md)) | 200 |
| Asignaciones | `GET` / `PUT /{r}/:id/{relacion}` con `{ ids }` | |

**Alcance** en cada método, con un helper común:
- Lecturas fuera de alcance → 404.
- Crear o editar con un cliente destino fuera de alcance → 403; a los roles 6/9 se les fija el de su sesión.
- Editar nunca filtra por el cliente del token: valida el cliente del recurso.

**Roles:**
- Catálogos: lectura para todos, escritura roles 1–3.
- Usuarios: nadie asigna un rol con más privilegio que el suyo.

**Errores:**
- 400 validación.
- 404 no existe o fuera de alcance.
- 409 duplicado.
- 500 sin detalle interno.

## 5. Plan

1. ✅ **Hecho el 30/10/2026 (sin cambio de contrato):** C1–C7, con pruebas en `test/e2e-ordenes/acceso.e2e-spec.ts` y unitarias por módulo. Reglas de usuarios en `src/usuarios/usuarios-alcance.ts`. Solo cambia que lo ajeno responde 404 o 403 y que administración ya puede editar lo de los clientes hijos.
2. **Con los equipos de la App y del front (cambia contratos):**
   - catálogos de tipos;
   - `list` uniforme;
   - paginación única con búsqueda;
   - estatus explícito;
   - `PUT` → `PATCH`.

   Se agregan las rutas nuevas y se mantienen las viejas como alias hasta que el front y la App migren.
3. **Con el motor de activos:** estatus de dispositivos, SIM y productos.

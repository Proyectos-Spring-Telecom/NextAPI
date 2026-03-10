# Flujo: Corrección de @Roles() y Rutas de Estatus

Este documento describe el flujo que se seguirá para alinear el proyecto NextAPI con las especificaciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Referencias:**
- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Secciones 6.2, 6.4
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar), 10 (Endpoints)

---

## 1. Especificaciones del contrato y contexto

### 1.1 Decorador @Roles()

| Documento | Especificación |
|-----------|----------------|
| CONTRATO 6.2 | Decorador `@Roles()` para control de acceso |
| CONTRATO 6.4 (catálogos) | `JwtAuthGuard` + `RolesGuard` + `@Roles()` |
| CONTEXTO 4.1 | `Guards`: `JwtAuthGuard` + `RolesGuard` + `@Roles()` |

**Interpretación:** El decorador `@Roles()` se usa para control de acceso. Cuando se invoca sin argumentos, el `RolesGuard` permite el acceso a cualquier usuario autenticado. Cuando se invoca con IDs (`@Roles(1)`, `@Roles(1, 2, 3)`), restringe a esos roles.

**CONTEXTO sección 10 (Endpoints)** especifica restricciones por rol en módulos core:
- Clientes: Crear (Roles 1), Eliminar (Roles 1)
- Usuarios: Crear (Roles 1), Eliminar (Roles 1)
- Roles, Permisos, Modulos: Crear (Roles 1), Eliminar (Roles 1)
- Bitácora, S3: acceso a roles 1, 2, 3

### 1.2 Rutas de estatus

| Documento | Especificación |
|-----------|----------------|
| CONTRATO 6.4 | `PATCH /estatus/:id` (explícito) |
| CONTEXTO 4.1 | `PATCH /estatus/:id` (explícito) |
| CONTEXTO 10 | Tablas de endpoints: `PATCH /estatus/:id` |

**Convención:** La ruta para cambiar estatus (soft delete) debe ser `PATCH /estatus/:id`, no `PATCH /:id/estatus`.

---

## 2. Estado actual vs. especificación

### 2.1 Uso de @Roles()

| Módulo | Uso actual | Cumple contrato |
|--------|------------|-----------------|
| **Catálogos** (todos los cat-*) | `@Roles()` | ✅ Sí |
| Clientes | `@Roles(1, 2, 3)` clase, `@Roles(1)` en create/delete | ⚠️ Ver nota |
| Usuarios | `@Roles()` clase, `@Roles(1)` en create/delete | ⚠️ Ver nota |
| Roles | `@Roles(1, 2, 3)`, `@Roles(1)` | ⚠️ Ver nota |
| Permisos | `@Roles(1, 2, 3)`, `@Roles(1)` | ⚠️ Ver nota |
| Modulos | `@Roles(1, 2, 3)`, `@Roles(1)` | ⚠️ Ver nota |
| Bitácora | `@Roles(1, 2, 3)` | ⚠️ Ver nota |
| S3 | `@Roles(1, 2, 3)` | ⚠️ Ver nota |

**Nota:** El CONTRATO indica `@Roles()` genérico. El CONTEXTO (endpoints) indica restricciones "(Roles 1)" en acciones críticas. Se asume que el CONTRATO permite `@Roles(idRol)` cuando el CONTEXTO lo especifica. Por tanto, **no se modificará** el uso de `@Roles()` en los módulos core; ya están alineados con el CONTEXTO.

**Acción:** Ninguna. Los catálogos ya usan `@Roles()`; los módulos core usan `@Roles(idRol)` según lo definido en el CONTEXTO.

### 2.2 Rutas de estatus

| Módulo | Ruta actual | Ruta esperada | Acción |
|--------|-------------|---------------|--------|
| Clientes | `PATCH estatus/:id` | `PATCH estatus/:id` | ✅ Ninguna |
| Usuarios | `PATCH estatus/:id` | `PATCH estatus/:id` | ✅ Ninguna |
| Roles | `PATCH estatus/:id` | `PATCH estatus/:id` | ✅ Ninguna |
| Permisos | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| Modulos | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-categoria-licencia | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-estatus-dispositivo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-estatus-instalacion | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-estatus-operador | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-estatus-sim | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-estatus-vehiculo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-marca-dispositivo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-marca-vehiculo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-modelo-dispositivo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-modelo-vehiculo | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-telefonia | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |
| cat-planes-telefonia | `PATCH :id/estatus` | `PATCH estatus/:id` | 🔧 Corregir |

**Total a corregir:** 14 controladores.

---

## 3. Flujo de corrección de rutas de estatus

### 3.1 Alcance

Solo se modificará el **decorador de ruta** en cada controller. No se modifican:
- Lógica del service
- DTOs
- Parámetros (`@Param('id')` sigue igual)
- Cuerpo de la petición

### 3.2 Cambio por archivo

**Antes:**
```typescript
@Patch(':id/estatus')
@ApiOperation({ summary: '...' })
async updateEstatus(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateXxxEstatusDto,
  @Request() req,
): Promise<ApiCrudResponse> {
  // ...
}
```

**Después:**
```typescript
@Patch('estatus/:id')
@ApiOperation({ summary: '...' })
async updateEstatus(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateXxxEstatusDto,
  @Request() req,
): Promise<ApiCrudResponse> {
  // ...
}
```

**Diferencia:** `@Patch(':id/estatus')` → `@Patch('estatus/:id')`

### 3.3 Orden de ejecución

1. **Permisos** — `src/permisos/permisos.controller.ts`
2. **Modulos** — `src/modulos/modulos.controller.ts`
3. **Catálogos** (orden alfabético):
   - `src/cat-categoria-licencia/cat-categoria-licencia.controller.ts`
   - `src/cat-estatus-dispositivo/cat-estatus-dispositivo.controller.ts`
   - `src/cat-estatus-instalacion/cat-estatus-instalacion.controller.ts`
   - `src/cat-estatus-operador/cat-estatus-operador.controller.ts`
   - `src/cat-estatus-sim/cat-estatus-sim.controller.ts`
   - `src/cat-estatus-vehiculo/cat-estatus-vehiculo.controller.ts`
   - `src/cat-marca-dispositivo/cat-marca-dispositivo.controller.ts`
   - `src/cat-marca-vehiculo/cat-marca-vehiculo.controller.ts`
   - `src/cat-modelo-dispositivo/cat-modelo-dispositivo.controller.ts`
   - `src/cat-modelo-vehiculo/cat-modelo-vehiculo.controller.ts`
   - `src/cat-planes-telefonia/cat-planes-telefonia.controller.ts`
   - `src/cat-telefonia/cat-telefonia.controller.ts`

### 3.4 Consideración: orden de rutas en NestJS

Las rutas **concretas** deben declararse antes que las **parametrizadas** para evitar que `estatus` o `:id` capturen la petición.

**Ejemplo correcto (catálogos):**
```typescript
@Get('list')        // Ruta concreta primero
findAllList() { ... }

@Get(':page/:limit') // Parametrizada
findAll() { ... }

@Get(':id')         // Parametrizada
findOne() { ... }

@Patch('estatus/:id') // Ruta concreta "estatus" + param :id
updateEstatus() { ... }
```

En catálogos, `estatus` es un segmento fijo; `estatus/:id` no entra en conflicto con `:id` porque NestJS resuelve por coincidencia. Al usar `@Patch('estatus/:id')`, la ruta completa será `GET /api/cat-xxx/:id` para `findOne` y `PATCH /api/cat-xxx/estatus/:id` para estatus, por lo que no hay conflicto.

**Permisos y Modulos:** Verificar que no exista ruta `GET /permisos/estatus/:id` o similar que colisione. Si solo hay `GET /:id` y `PATCH /:id/estatus`, cambiar a `PATCH estatus/:id` es seguro.

### 3.5 Impacto en clientes de la API

**Rutas que cambian:**

| Antes | Después |
|-------|---------|
| `PATCH /api/permisos/:id/estatus` | `PATCH /api/permisos/estatus/:id` |
| `PATCH /api/modulos/:id/estatus` | `PATCH /api/modulos/estatus/:id` |
| `PATCH /api/cat-*/:id/estatus` | `PATCH /api/cat-*/estatus/:id` |

Los consumidores (frontend, Postman, etc.) deben actualizar las URLs.

---

## 4. Actualización de documentación

Tras corregir los controllers, se actualizarán los documentos de flujo de catálogos que referencien la ruta antigua:

- `docs/FLUJO-CATALOGO-MARCA-DISPOSITIVO.md`
- `docs/FLUJO-CATALOGO-ESTATUS-VEHICULO.md`
- `docs/FLUJO-CATALOGO-ESTATUS-SIM.md`
- `docs/FLUJO-CATALOGO-ESTATUS-OPERADOR.md`
- `docs/FLUJO-CATALOGO-ESTATUS-INSTALACION.md`
- `docs/FLUJO-CATALOGO-ESTATUS-DISPOSITIVO.md`
- `docs/FLUJO-CATALOGO-CATEGORIA-LICENCIA.md`
- Otros flujos que incluyan `PATCH /:id/estatus`

**Cambio en flujos:** Reemplazar `PATCH /:id/estatus` por `PATCH /estatus/:id` en tablas de rutas y ejemplos.

---

## 5. Verificación post-corrección

1. **Compilación:** `npm run build` sin errores.
2. **Rutas:** Comprobar en Swagger (`/api/docs`) que las rutas de estatus aparecen como `PATCH .../estatus/{id}`.
3. **Pruebas manuales:** Llamar a `PATCH /api/cat-marca-dispositivo/estatus/1` (u otra entidad) y verificar que responde correctamente.
4. **Coherencia:** Revisar que CONTEXTO y CONTRATO sigan reflejando `PATCH /estatus/:id`.

---

## 6. Resumen

| Tarea | Archivos | Acción |
|-------|----------|--------|
| **@Roles()** | — | Sin cambios (catálogos correctos; core alineado con CONTEXTO) |
| **Rutas estatus** | 14 controllers | Cambiar `@Patch(':id/estatus')` → `@Patch('estatus/:id')` |
| **Documentación** | Flujos FLUJO-CATALOGO-*.md | Actualizar referencias a la ruta de estatus |

---

*Documento de referencia para la corrección de desviaciones respecto a CONTRATO y CONTEXTO.*

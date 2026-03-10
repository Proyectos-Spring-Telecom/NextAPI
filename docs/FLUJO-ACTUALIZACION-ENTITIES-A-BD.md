# Flujo: Actualizar entities para coincidir con la BD

Este documento describe el flujo paso a paso para corregir las diferencias encontradas entre las **entities** de NextAPI y las **tablas** de la base de datos (`Next20260309.sql`), según `docs/VERIFICACION-ENTITIES-TABLAS-BD.md`.

**Objetivo:** Alinear las entities con la estructura real de la BD antes de realizar cambios funcionales.

---

## 1. Resumen de cambios

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `Bitacora.ts` | IdModulo: agregar `nullable: true` |
| 2 | `CatEstatusDispositivo.ts` | Id: cambiar `int` → `bigint` |
| 3 | `CatEstatusInstalacion.ts` | Id: cambiar `int` → `bigint` |
| 4 | `CatEstatusOperador.ts` | Id: cambiar `int` → `bigint` |
| 5 | `CatEstatusSim.ts` | Id: cambiar `int` → `bigint` |
| 6 | `CatEstatusVehiculo.ts` | Id: cambiar `int` → `bigint` |
| 7 | `CatPlanesTelefonia.ts` | Agregar `FechaCreacion` y `FechaActualizacion` |
| 8 | `CatReferenciaServicio.ts` | Id: cambiar `int` → `bigint` |

---

## 2. Paso 1: Bitacora.ts

**Archivo:** `src/entities/Bitacora.ts`

**Cambio:** Hacer `IdModulo` nullable para coincidir con la BD (`bigint DEFAULT NULL`).

**Antes:**
```typescript
@Column("bigint", { name: "IdModulo" })
idModulo: number;
```

**Después:**
```typescript
@Column("bigint", { name: "IdModulo", nullable: true })
idModulo: number | null;
```

**Nota:** Si el código de Bitácora asume siempre un IdModulo válido, revisar los lugares que llaman a `logToBitacora` con `idModulo` opcional.

---

## 3. Paso 2: CatEstatusDispositivo.ts

**Archivo:** `src/entities/CatEstatusDispositivo.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 4. Paso 3: CatEstatusInstalacion.ts

**Archivo:** `src/entities/CatEstatusInstalacion.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 5. Paso 4: CatEstatusOperador.ts

**Archivo:** `src/entities/CatEstatusOperador.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 6. Paso 5: CatEstatusSim.ts

**Archivo:** `src/entities/CatEstatusSim.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 7. Paso 6: CatEstatusVehiculo.ts

**Archivo:** `src/entities/CatEstatusVehiculo.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 8. Paso 7: CatPlanesTelefonia.ts

**Archivo:** `src/entities/CatPlanesTelefonia.ts`

**Cambio:** Agregar `FechaCreacion` y `FechaActualizacion` según la BD.

La tabla BD tiene:
```sql
`FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
```

**Agregar** (después de `estatus`, antes del decorador `@ManyToOne`):

Importar `CreateDateColumn` y `UpdateDateColumn` de typeorm:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
```

Agregar las columnas:

```typescript
@CreateDateColumn({ name: 'FechaCreacion' })
fechaCreacion: Date;

@UpdateDateColumn({ name: 'FechaActualizacion' })
fechaActualizacion: Date;
```

**Nota:** `@CreateDateColumn` y `@UpdateDateColumn` generan en BD el equivalente a `DEFAULT CURRENT_TIMESTAMP` y `ON UPDATE CURRENT_TIMESTAMP`. Alternativamente, se puede usar `@Column` con `default`, igual que en `Modulos.ts` o `Permisos.ts`.

---

## 9. Paso 8: CatReferenciaServicio.ts

**Archivo:** `src/entities/CatReferenciaServicio.ts`

**Cambio:** Id de `int` a `bigint`.

**Antes:**
```typescript
@PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
id: number;
```

**Después:**
```typescript
@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
id: number;
```

---

## 10. Orden sugerido de aplicación

Aplicar los cambios en el siguiente orden para minimizar conflictos:

1. **Bitacora** (nullable IdModulo)
2. **CatEstatusDispositivo**
3. **CatEstatusInstalacion**
4. **CatEstatusOperador**
5. **CatEstatusSim**
6. **CatEstatusVehiculo**
7. **CatReferenciaServicio**
8. **CatPlanesTelefonia** (agregar columnas)

---

## 11. Validación post-cambios

1. Ejecutar `npm run build` para verificar que no hay errores de compilación.
2. Revisar los servicios que usan estas entities (especialmente Bitacora y CatPlanesTelefonia) para ajustar tipos si es necesario.
3. Ejecutar pruebas funcionales de los módulos afectados.

---

## 12. Archivos impactados (posibles ajustes)

| Módulo | Impacto potencial |
|--------|-------------------|
| **BitacoraLoggerService** | Si `idModulo` puede ser null, validar tipos en `logToBitacora` |
| **CatPlanesTelefonia** | Los DTOs de create/update podrían excluir FechaCreacion/FechaActualizacion; la BD las maneja por defecto |
| **CatEstatus*** | Los services que normalizan `id` a `Number()` siguen siendo válidos |

---

## 13. Referencias

- `docs/VERIFICACION-ENTITIES-TABLAS-BD.md` — Diferencias detectadas
- `a:\Spring\Next\BD-Respaldos\Next20260309.sql` — Estructura de referencia

*Documento de referencia para alinear entities con la BD.*

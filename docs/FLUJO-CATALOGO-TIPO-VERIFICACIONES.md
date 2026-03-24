# Flujo: Crear módulo de catálogo CatTipoVerificaciones

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoVerificaciones** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Este catálogo es de **Fase 3** (Mantenimiento). La tabla ya existe en BD con 2 registros.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoVerificaciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo mínimo sin FK ni timestamps. Solo incluye `Id`, `Nombre` y `Estatus`. Se usa para tipos de verificaciones vehiculares (verificación física, verificación ambiental, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoVerificaciones

**Archivo:** `src/entities/CatTipoVerificaciones.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoVerificaciones_Estatus', ['estatus'])
@Entity('CatTipoVerificaciones')
export class CatTipoVerificaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── CatTipoVerificaciones.ts
└── cat-tipo-verificaciones/
    ├── cat-tipo-verificaciones.module.ts
    ├── cat-tipo-verificaciones.controller.ts
    ├── cat-tipo-verificaciones.service.ts
    └── dto/
        ├── create-cat-tipo-verificaciones.dto.ts
        ├── update-cat-tipo-verificaciones.dto.ts
        └── update-cat-tipo-verificaciones-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-verificaciones.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCatTipoVerificacionesDto {
  @ApiProperty({
    description: 'Nombre del tipo de verificación',
    example: 'Verificación física',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}
```

### update-cat-tipo-verificaciones.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoVerificacionesDto } from './create-cat-tipo-verificaciones.dto';

export class UpdateCatTipoVerificacionesDto extends PartialType(
  CreateCatTipoVerificacionesDto,
) {}
```

### update-cat-tipo-verificaciones-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoVerificacionesEstatusDto {
  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
  })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}
```

---

## 5. Paso 4: Service

**Archivo:** `src/cat-tipo-verificaciones/cat-tipo-verificaciones.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar `ID_MODULO_VERIFICACIONES = 23` (CatTipoVerificaciones es atributo del módulo Verificaciones/Mantenimiento, Fase 3). **Importante:** El módulo Verificaciones (Id 23) puede no existir aún en la tabla `Modulos`; agregar el registro antes de usar la Bitácora:

```sql
INSERT INTO Modulos (Nombre, Descripcion, Estatus) VALUES
('Verificaciones', 'Tipos de verificaciones vehiculares (física, ambiental, etc.)', 1);
```

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-verificaciones/cat-tipo-verificaciones.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Verificaciones')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Verificaciones)
- `@Controller('cat-tipo-verificaciones')`

**Rutas (orden crítico para NestJS):**

| Método | Ruta | Método Service |
|--------|------|----------------|
| GET | `/list` | findAllList(soloActivos) |
| GET | `/:page/:limit` | findAll(page, limit, soloActivos) |
| GET | `/:id` | findOne(id) |
| POST | `/` | create(dto, req.user.userId) |
| PATCH | `/:id` | update(id, dto, req.user.userId) |
| PATCH | `estatus/:id` | updateEstatus(id, dto, req.user.userId) |

**Importante:** Rutas concretas (`/list`) deben declararse antes que las parametrizadas (`/:id`). Rutas de estatus: `PATCH /estatus/:id` según CONTRATO 6.6 y CONTEXTO 4.1.

---

## 7. Paso 6: Module

**Archivo:** `src/cat-tipo-verificaciones/cat-tipo-verificaciones.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoVerificaciones } from 'src/entities/CatTipoVerificaciones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoVerificacionesController } from './cat-tipo-verificaciones.controller';
import { CatTipoVerificacionesService } from './cat-tipo-verificaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoVerificaciones]),
    BitacoraModule,
  ],
  controllers: [CatTipoVerificacionesController],
  providers: [CatTipoVerificacionesService],
  exports: [CatTipoVerificacionesService],
})
export class CatTipoVerificacionesModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoVerificacionesModule } from './cat-tipo-verificaciones/cat-tipo-verificaciones.module';

// ...
CatTipoVerificacionesModule,
```

---

## 9. Resumen de convenciones aplicadas

| Elemento | Valor |
|----------|-------|
| applySchema | Default: `Next` |
| ApiBearerAuth | `'bearer-token'` |
| Guards | JwtAuthGuard + RolesGuard + @Roles() |
| GET /list | Query `soloActivos` opcional |
| Rutas estatus | PATCH /estatus/:id |
| DELETE | Soft delete vía PATCH estatus |
| Bitácora | En create, update, updateEstatus |
| Respuestas | ApiCrudResponse, ApiResponseCommon |
| Paginación | GET /list + GET /:page/:limit |
| IdModulo Bitácora | 23 (Verificaciones) |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-verificaciones/list?soloActivos=true`
- `GET /api/cat-tipo-verificaciones/:page/:limit`
- `GET /api/cat-tipo-verificaciones/:id`
- `POST /api/cat-tipo-verificaciones/`
- `PATCH /api/cat-tipo-verificaciones/:id`
- `PATCH /api/cat-tipo-verificaciones/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de verificaciones vehiculares (verificación física, verificación ambiental, etc.). Es referenciado por el módulo de Mantenimiento (Fase 3) cuando se registran verificaciones de vehículos.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.6 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)
- `docs/RESUMEN-BD-Next20260309.md` — CatTipoVerificaciones en BD (Fase 3)

*Documento de referencia para implementar el catálogo CatTipoVerificaciones en NextAPI.*

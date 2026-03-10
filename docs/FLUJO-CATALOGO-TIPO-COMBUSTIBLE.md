# Flujo: Crear módulo de catálogo CatTipoCombustible

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoCombustible** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoCombustible` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo mínimo sin FK ni timestamps. Solo incluye `Id`, `Nombre` y `Estatus`. Se usa para tipos de combustible de vehículos (gasolina, diésel, eléctrico, híbrido, GLP, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoCombustible

**Archivo:** `src/entities/CatTipoCombustible.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoCombustible_Estatus', ['estatus'])
@Entity('CatTipoCombustible')
export class CatTipoCombustible {
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
│   └── CatTipoCombustible.ts
└── cat-tipo-combustible/
    ├── cat-tipo-combustible.module.ts
    ├── cat-tipo-combustible.controller.ts
    ├── cat-tipo-combustible.service.ts
    └── dto/
        ├── create-cat-tipo-combustible.dto.ts
        ├── update-cat-tipo-combustible.dto.ts
        └── update-cat-tipo-combustible-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-combustible.dto.ts

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

export class CreateCatTipoCombustibleDto {
  @ApiProperty({
    description: 'Nombre del tipo de combustible',
    example: 'Gasolina',
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

### update-cat-tipo-combustible.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoCombustibleDto } from './create-cat-tipo-combustible.dto';

export class UpdateCatTipoCombustibleDto extends PartialType(
  CreateCatTipoCombustibleDto,
) {}
```

### update-cat-tipo-combustible-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoCombustibleEstatusDto {
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

**Archivo:** `src/cat-tipo-combustible/cat-tipo-combustible.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar `ID_MODULO_VEHICULOS = 16` (CatTipoCombustible es atributo de vehículos). Revisar tabla `Modulos` en BD si se requiere otro valor.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-combustible/cat-tipo-combustible.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Combustible')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Vehículos)
- `@Controller('cat-tipo-combustible')`

**Rutas (orden crítico para NestJS):**

| Método | Ruta | Método Service |
|--------|------|----------------|
| GET | `/list` | findAllList(soloActivos) |
| GET | `/:page/:limit` | findAll(page, limit, soloActivos) |
| GET | `/:id` | findOne(id) |
| POST | `/` | create(dto, req.user.userId) |
| PATCH | `/:id` | update(id, dto, req.user.userId) |
| PATCH | `estatus/:id` | updateEstatus(id, dto, req.user.userId) |

**Importante:** Rutas concretas (`/list`) deben declararse antes que las parametrizadas (`/:id`). Rutas de estatus: `PATCH /estatus/:id` según CONTRATO 6.4 y CONTEXTO 4.1.

---

## 7. Paso 6: Module

**Archivo:** `src/cat-tipo-combustible/cat-tipo-combustible.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoCombustibleController } from './cat-tipo-combustible.controller';
import { CatTipoCombustibleService } from './cat-tipo-combustible.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoCombustible]),
    BitacoraModule,
  ],
  controllers: [CatTipoCombustibleController],
  providers: [CatTipoCombustibleService],
  exports: [CatTipoCombustibleService],
})
export class CatTipoCombustibleModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';

// ...
CatTipoCombustibleModule,
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
| IdModulo Bitácora | 16 (Vehículos) |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-combustible/list?soloActivos=true`
- `GET /api/cat-tipo-combustible/:page/:limit`
- `GET /api/cat-tipo-combustible/:id`
- `POST /api/cat-tipo-combustible/`
- `PATCH /api/cat-tipo-combustible/:id`
- `PATCH /api/cat-tipo-combustible/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de combustible para vehículos (gasolina, diésel, eléctrico, híbrido, GLP, etc.). Es referenciado por el módulo de Vehículos cuando se define el tipo de combustible de cada unidad.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.4 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)

*Documento de referencia para implementar el catálogo CatTipoCombustible en NextAPI.*

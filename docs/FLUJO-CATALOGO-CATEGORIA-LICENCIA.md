# Flujo: Crear módulo de catálogo CatCategoriaLicencia

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatCategoriaLicencia** en NextAPI, siguiendo las convenciones del proyecto.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatCategoriaLicencia` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo simple sin FK ni timestamps. Es la tabla padre de `Licencias` (IdCategoriaLicencia).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatCategoriaLicencia

**Archivo:** `src/entities/CatCategoriaLicencia.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatCategoriaLicencia_Estatus', ['estatus'])
@Entity('CatCategoriaLicencia')
export class CatCategoriaLicencia {
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
│   └── CatCategoriaLicencia.ts
└── cat-categoria-licencia/
    ├── cat-categoria-licencia.module.ts
    ├── cat-categoria-licencia.controller.ts
    ├── cat-categoria-licencia.service.ts
    └── dto/
        ├── create-cat-categoria-licencia.dto.ts
        ├── update-cat-categoria-licencia.dto.ts
        └── update-cat-categoria-licencia-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-categoria-licencia.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatCategoriaLicenciaDto {
  @ApiProperty({
    description: 'Nombre de la categoría de licencia',
    example: 'Permanente',
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

### update-cat-categoria-licencia.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatCategoriaLicenciaDto } from './create-cat-categoria-licencia.dto';

export class UpdateCatCategoriaLicenciaDto extends PartialType(
  CreateCatCategoriaLicenciaDto,
) {}
```

### update-cat-categoria-licencia-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatCategoriaLicenciaEstatusDto {
  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1 })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}
```

---

## 5. Paso 4: Service

**Archivo:** `src/cat-categoria-licencia/cat-categoria-licencia.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar el IdModulo del módulo Licencias (19 según ANALISIS-BD-NEXT) o el que corresponda en BD.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-categoria-licencia/cat-categoria-licencia.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Categoría Licencia')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o según permisos del módulo Licencias)
- `@Controller('cat-categoria-licencia')`

**Rutas (orden crítico para NestJS):**

| Método | Ruta | Método Service |
|--------|------|----------------|
| GET | `/list` | findAllList(soloActivos) |
| GET | `/:page/:limit` | findAll(page, limit, soloActivos) |
| GET | `/:id` | findOne(id) |
| POST | `/` | create(dto, req.user.userId) |
| PUT | `/:id` | update(id, dto, req.user.userId) |
| PATCH | `estatus/:id` | updateEstatus(id, dto, req.user.userId) |

**Importante:** Rutas concretas (`/list`) deben declararse antes que las parametrizadas (`/:id`).

---

## 7. Paso 6: Module

**Archivo:** `src/cat-categoria-licencia/cat-categoria-licencia.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatCategoriaLicencia } from 'src/entities/CatCategoriaLicencia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatCategoriaLicenciaController } from './cat-categoria-licencia.controller';
import { CatCategoriaLicenciaService } from './cat-categoria-licencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatCategoriaLicencia]),
    BitacoraModule,
  ],
  controllers: [CatCategoriaLicenciaController],
  providers: [CatCategoriaLicenciaService],
  exports: [CatCategoriaLicenciaService],
})
export class CatCategoriaLicenciaModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatCategoriaLicenciaModule } from './cat-categoria-licencia/cat-categoria-licencia.module';

// ...
CatCategoriaLicenciaModule,
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

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-categoria-licencia/list?soloActivos=true`
- `GET /api/cat-categoria-licencia/:page/:limit`
- `GET /api/cat-categoria-licencia/:id`
- `POST /api/cat-categoria-licencia/`
- `PUT /api/cat-categoria-licencia/:id`
- `PATCH /api/cat-categoria-licencia/estatus/:id`

---

## 11. Relación con Licencias

Este catálogo es referenciado por la tabla **Licencias** (campo `IdCategoriaLicencia`). Valores típicos: Permanente, Temporal. Se usa al implementar el módulo LicenciasModule.

---

*Documento de referencia para implementar el catálogo CatCategoriaLicencia en NextAPI.*

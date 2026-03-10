# Flujo: Crear módulo de catálogo CatCategoriaMantenimientoMecanico

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatCategoriaMantenimientoMecanico** en NextAPI, siguiendo las convenciones del proyecto.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatCategoriaMantenimientoMecanico` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(200) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo simple sin FK ni timestamps. Es la tabla padre de `CatCaracteristicasEvaluacionMttoMecanico`.

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatCategoriaMantenimientoMecanico

**Archivo:** `src/entities/CatCategoriaMantenimientoMecanico.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatCategoriaMantenimientoMecanico_Estatus', ['estatus'])
@Entity('CatCategoriaMantenimientoMecanico')
export class CatCategoriaMantenimientoMecanico {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 200 })
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
│   └── CatCategoriaMantenimientoMecanico.ts
└── cat-categoria-mantenimiento-mecanico/
    ├── cat-categoria-mantenimiento-mecanico.module.ts
    ├── cat-categoria-mantenimiento-mecanico.controller.ts
    ├── cat-categoria-mantenimiento-mecanico.service.ts
    └── dto/
        ├── create-cat-categoria-mantenimiento-mecanico.dto.ts
        ├── update-cat-categoria-mantenimiento-mecanico.dto.ts
        └── update-cat-categoria-mantenimiento-mecanico-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-categoria-mantenimiento-mecanico.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatCategoriaMantenimientoMecanicoDto {
  @ApiProperty({
    description: 'Nombre de la categoría',
    example: 'Motor',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
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

### update-cat-categoria-mantenimiento-mecanico.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatCategoriaMantenimientoMecanicoDto } from './create-cat-categoria-mantenimiento-mecanico.dto';

export class UpdateCatCategoriaMantenimientoMecanicoDto extends PartialType(
  CreateCatCategoriaMantenimientoMecanicoDto,
) {}
```

### update-cat-categoria-mantenimiento-mecanico-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatCategoriaMantenimientoMecanicoEstatusDto {
  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1 })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}
```

---

## 5. Paso 4: Service

**Archivo:** `src/cat-categoria-mantenimiento-mecanico/cat-categoria-mantenimiento-mecanico.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Verificar en BD si existe módulo de Mantenimiento. Si no, usar uno genérico (ej. 5 Modulos) o agregar el módulo correspondiente.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-categoria-mantenimiento-mecanico/cat-categoria-mantenimiento-mecanico.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Categoría Mantenimiento Mecánico')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles(1, 2, 3)` (o según permisos)
- `@Controller('cat-categoria-mantenimiento-mecanico')`

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

**Archivo:** `src/cat-categoria-mantenimiento-mecanico/cat-categoria-mantenimiento-mecanico.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatCategoriaMantenimientoMecanico } from 'src/entities/CatCategoriaMantenimientoMecanico';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatCategoriaMantenimientoMecanicoController } from './cat-categoria-mantenimiento-mecanico.controller';
import { CatCategoriaMantenimientoMecanicoService } from './cat-categoria-mantenimiento-mecanico.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatCategoriaMantenimientoMecanico]),
    BitacoraModule,
  ],
  controllers: [CatCategoriaMantenimientoMecanicoController],
  providers: [CatCategoriaMantenimientoMecanicoService],
  exports: [CatCategoriaMantenimientoMecanicoService],
})
export class CatCategoriaMantenimientoMecanicoModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatCategoriaMantenimientoMecanicoModule } from './cat-categoria-mantenimiento-mecanico/cat-categoria-mantenimiento-mecanico.module';

// ...
CatCategoriaMantenimientoMecanicoModule,
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

- `GET /api/cat-categoria-mantenimiento-mecanico/list?soloActivos=true`
- `GET /api/cat-categoria-mantenimiento-mecanico/:page/:limit`
- `GET /api/cat-categoria-mantenimiento-mecanico/:id`
- `POST /api/cat-categoria-mantenimiento-mecanico/`
- `PUT /api/cat-categoria-mantenimiento-mecanico/:id`
- `PATCH /api/cat-categoria-mantenimiento-mecanico/estatus/:id`

---

## 11. Relación con CatCaracteristicasEvaluacionMttoMecanico

Este catálogo es el **padre** de `CatCaracteristicasEvaluacionMttoMecanico`. Se recomienda implementar primero `CatCategoriaMantenimientoMecanico` y después el catálogo de características, ya que estas referencian `IdCatCategoriaMantenimientoMecanico`.

Ver: `docs/FLUJO-CATALOGO-CARACTERISTICAS-EVALUACION-MTTO.md`

---

*Documento de referencia para implementar el catálogo CatCategoriaMantenimientoMecanico en NextAPI.*

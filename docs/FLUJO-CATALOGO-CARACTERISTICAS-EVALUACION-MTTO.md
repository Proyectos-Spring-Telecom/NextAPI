# Flujo: Crear módulo de catálogo CatCaracteristicasEvaluacionMttoMecanico

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatCaracteristicasEvaluacionMttoMecanico** en NextAPI, siguiendo las convenciones del proyecto.

---

## 1. Entidad y dependencia

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatCaracteristicasEvaluacionMttoMecanico` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(250) NOT NULL,
  `IdCatCategoriaMantenimientoMecanico` int NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  KEY `FK_SubCat_CategoriaMantenimientoMecanico` (`IdCatCategoriaMantenimientoMecanico`),
  CONSTRAINT `FK_SubCat_CategoriaMantenimientoMecanico` 
    FOREIGN KEY (`IdCatCategoriaMantenimientoMecanico`) 
    REFERENCES `CatCategoriaMantenimientoMecanico` (`Id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Esta tabla no tiene `FechaCreacion` ni `FechaActualizacion`; es un catálogo simple con FK.

### 1.2 Dependencia

Este catálogo depende de **CatCategoriaMantenimientoMecanico**. Debe existir la entidad `CatCategoriaMantenimientoMecanico` antes de crear CaracteristicasEvaluacionMttoMecanico.

**Orden de implementación:**
1. `CatCategoriaMantenimientoMecanico` (padre)
2. `CatCaracteristicasEvaluacionMttoMecanico` (hijo)

---

## 2. Paso 1: Entidad CatCategoriaMantenimientoMecanico (si no existe)

Crear `src/entities/CatCategoriaMantenimientoMecanico.ts` **antes** que la entidad hija:

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatCategoriaMantenimientoMecanico_Estatus', ['estatus'])
@Entity('CatCategoriaMantenimientoMecanico')
export class CatCategoriaMantenimientoMecanico {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
```

*(Ajustar según la estructura real de la tabla en BD. Opcional: agregar `@OneToMany` a CaracteristicasEvaluacionMttoMecanico después de crear la entidad hija.)*

---

## 3. Paso 2: Entidad CatCaracteristicasEvaluacionMttoMecanico

**Archivo:** `src/entities/CatCaracteristicasEvaluacionMttoMecanico.ts`

```typescript
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatCategoriaMantenimientoMecanico } from './CatCategoriaMantenimientoMecanico';

@applySchema
@Index('IX_CatCaracteristicasEvaluacionMttoMecanico_Estatus', ['estatus'])
@Index('FK_SubCat_CategoriaMantenimientoMecanico', ['idCatCategoriaMantenimientoMecanico'])
@Entity('CatCaracteristicasEvaluacionMttoMecanico')
export class CatCaracteristicasEvaluacionMttoMecanico {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 250 })
  nombre: string;

  @Column('int', { name: 'IdCatCategoriaMantenimientoMecanico' })
  idCatCategoriaMantenimientoMecanico: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(
    () => CatCategoriaMantenimientoMecanico,
    (cat) => cat.caracteristicas,
    { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  )
  @JoinColumn({ name: 'IdCatCategoriaMantenimientoMecanico' })
  categoriaMantenimientoMecanico: CatCategoriaMantenimientoMecanico;
}
```

---

## 4. Paso 3: Estructura de carpetas y archivos

```
src/
├── entities/
│   ├── CatCategoriaMantenimientoMecanico.ts
│   └── CatCaracteristicasEvaluacionMttoMecanico.ts
└── cat-caracteristicas-evaluacion-mtto/
    ├── cat-caracteristicas-evaluacion-mtto.module.ts
    ├── cat-caracteristicas-evaluacion-mtto.controller.ts
    ├── cat-caracteristicas-evaluacion-mtto.service.ts
    └── dto/
        ├── create-cat-caracteristicas-evaluacion-mtto.dto.ts
        ├── update-cat-caracteristicas-evaluacion-mtto.dto.ts
        └── update-cat-caracteristicas-evaluacion-mtto-estatus.dto.ts
```

---

## 5. Paso 4: DTOs

### create-cat-caracteristicas-evaluacion-mtto.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatCaracteristicasEvaluacionMttoDto {
  @ApiProperty({ description: 'Nombre de la característica', example: 'Estado del aceite', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre: string;

  @ApiProperty({ description: 'ID de la categoría de mantenimiento mecánico', example: 1 })
  @IsInt()
  @IsNotEmpty()
  idCatCategoriaMantenimientoMecanico: number;

  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}
```

### update-cat-caracteristicas-evaluacion-mtto.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatCaracteristicasEvaluacionMttoDto } from './create-cat-caracteristicas-evaluacion-mtto.dto';

export class UpdateCatCaracteristicasEvaluacionMttoDto extends PartialType(
  CreateCatCaracteristicasEvaluacionMttoDto,
) {}
```

### update-cat-caracteristicas-evaluacion-mtto-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatCaracteristicasEvaluacionMttoEstatusDto {
  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1 })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}
```

---

## 6. Paso 5: Service

**Archivo:** `src/cat-caracteristicas-evaluacion-mtto/cat-caracteristicas-evaluacion-mtto.service.ts`

Responsabilidades:

- `create(dto, idUser)`: validar que `idCatCategoriaMantenimientoMecanico` exista, crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista con `relations: ['categoriaMantenimientoMecanico']`, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID con relación, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Verificar en BD si existe módulo de Mantenimiento. Si no, usar uno genérico (ej. 5 Modulos) o agregar el módulo correspondiente.

---

## 7. Paso 6: Controller

**Archivo:** `src/cat-caracteristicas-evaluacion-mtto/cat-caracteristicas-evaluacion-mtto.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Características Evaluación Mtto. Mecánico')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles(1, 2, 3)` (o según permisos)
- `@Controller('cat-caracteristicas-evaluacion-mtto')`

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

## 8. Paso 7: Module

**Archivo:** `src/cat-caracteristicas-evaluacion-mtto/cat-caracteristicas-evaluacion-mtto.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatCaracteristicasEvaluacionMttoMecanico } from 'src/entities/CatCaracteristicasEvaluacionMttoMecanico';
import { CatCategoriaMantenimientoMecanico } from 'src/entities/CatCategoriaMantenimientoMecanico';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatCaracteristicasEvaluacionMttoController } from './cat-caracteristicas-evaluacion-mtto.controller';
import { CatCaracteristicasEvaluacionMttoService } from './cat-caracteristicas-evaluacion-mtto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatCaracteristicasEvaluacionMttoMecanico,
      CatCategoriaMantenimientoMecanico,
    ]),
    BitacoraModule,
  ],
  controllers: [CatCaracteristicasEvaluacionMttoController],
  providers: [CatCaracteristicasEvaluacionMttoService],
  exports: [CatCaracteristicasEvaluacionMttoService],
})
export class CatCaracteristicasEvaluacionMttoModule {}
```

---

## 9. Paso 8: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatCaracteristicasEvaluacionMttoModule } from './cat-caracteristicas-evaluacion-mtto/cat-caracteristicas-evaluacion-mtto.module';

// ...
CatCaracteristicasEvaluacionMttoModule,
```

---

## 10. Resumen de convenciones aplicadas

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

## 11. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-caracteristicas-evaluacion-mtto/list?soloActivos=true`
- `GET /api/cat-caracteristicas-evaluacion-mtto/:page/:limit`
- `GET /api/cat-caracteristicas-evaluacion-mtto/:id`
- `POST /api/cat-caracteristicas-evaluacion-mtto/`
- `PUT /api/cat-caracteristicas-evaluacion-mtto/:id`
- `PATCH /api/cat-caracteristicas-evaluacion-mtto/estatus/:id`

---

*Documento de referencia para implementar el catálogo CatCaracteristicasEvaluacionMttoMecanico en NextAPI.*

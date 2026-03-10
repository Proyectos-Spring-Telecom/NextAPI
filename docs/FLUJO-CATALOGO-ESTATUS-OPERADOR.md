# Flujo: Crear módulo de catálogo CatEstatusOperador

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatEstatusOperador** en NextAPI, siguiendo las convenciones del proyecto.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatEstatusOperador` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(50) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo simple sin FK ni timestamps. Incluye campo opcional `Descripcion`. Es referenciado por la tabla `Operadores` (IdEstatusOperador).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatEstatusOperador

**Archivo:** `src/entities/CatEstatusOperador.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatEstatusOperador_Estatus', ['estatus'])
@Entity('CatEstatusOperador')
export class CatEstatusOperador {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 50 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── CatEstatusOperador.ts
└── cat-estatus-operador/
    ├── cat-estatus-operador.module.ts
    ├── cat-estatus-operador.controller.ts
    ├── cat-estatus-operador.service.ts
    └── dto/
        ├── create-cat-estatus-operador.dto.ts
        ├── update-cat-estatus-operador.dto.ts
        └── update-cat-estatus-operador-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-estatus-operador.dto.ts

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

export class CreateCatEstatusOperadorDto {
  @ApiProperty({
    description: 'Nombre del estatus',
    example: 'Activo',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del estatus',
    example: 'Operador activo y disponible',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

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

### update-cat-estatus-operador.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusOperadorDto } from './create-cat-estatus-operador.dto';

export class UpdateCatEstatusOperadorDto extends PartialType(
  CreateCatEstatusOperadorDto,
) {}
```

### update-cat-estatus-operador-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatEstatusOperadorEstatusDto {
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

**Archivo:** `src/cat-estatus-operador/cat-estatus-operador.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar el IdModulo del módulo Operadores (18 según ANALISIS-BD-NEXT).

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-estatus-operador/cat-estatus-operador.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Estatus Operador')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o según permisos del módulo Operadores)
- `@Controller('cat-estatus-operador')`

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

**Archivo:** `src/cat-estatus-operador/cat-estatus-operador.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatEstatusOperador } from 'src/entities/CatEstatusOperador';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatEstatusOperadorController } from './cat-estatus-operador.controller';
import { CatEstatusOperadorService } from './cat-estatus-operador.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatEstatusOperador]),
    BitacoraModule,
  ],
  controllers: [CatEstatusOperadorController],
  providers: [CatEstatusOperadorService],
  exports: [CatEstatusOperadorService],
})
export class CatEstatusOperadorModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';

// ...
CatEstatusOperadorModule,
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

- `GET /api/cat-estatus-operador/list?soloActivos=true`
- `GET /api/cat-estatus-operador/:page/:limit`
- `GET /api/cat-estatus-operador/:id`
- `POST /api/cat-estatus-operador/`
- `PUT /api/cat-estatus-operador/:id`
- `PATCH /api/cat-estatus-operador/estatus/:id`

---

## 11. Relación con Operadores

Este catálogo es referenciado por la tabla **Operadores** (campo `IdEstatusOperador`). Valores típicos: Activo, Suspendido, Incapacitado, Baja temporal, etc. Se usa al implementar el módulo OperadoresModule.

---

*Documento de referencia para implementar el catálogo CatEstatusOperador en NextAPI.*

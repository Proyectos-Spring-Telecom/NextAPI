# Flujo: Crear módulo de catálogo CatTipoAlerta

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoAlerta** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoAlerta` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Icono` varchar(100) DEFAULT NULL COMMENT 'Nombre o ruta del ícono para la UI',
  `Severidad` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '1=Info, 2=Advertencia, 3=Crítica',
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo sin FK ni timestamps. Incluye `Descripcion` e `Icono` opcionales, y `Severidad` (1=Info, 2=Advertencia, 3=Crítica). Se usa para tipos de alertas del sistema (exceso de velocidad, motor encendido, batería baja, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoAlerta

**Archivo:** `src/entities/CatTipoAlerta.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoAlerta_Estatus', ['estatus'])
@Index('IX_CatTipoAlerta_Severidad', ['severidad'])
@Entity('CatTipoAlerta')
export class CatTipoAlerta {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('varchar', {
    name: 'Icono',
    length: 100,
    nullable: true,
    comment: 'Nombre o ruta del ícono para la UI',
  })
  icono: string | null;

  @Column('tinyint', {
    name: 'Severidad',
    unsigned: true,
    default: 1,
    comment: '1=Info, 2=Advertencia, 3=Crítica',
  })
  severidad: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── CatTipoAlerta.ts
└── cat-tipo-alerta/
    ├── cat-tipo-alerta.module.ts
    ├── cat-tipo-alerta.controller.ts
    ├── cat-tipo-alerta.service.ts
    └── dto/
        ├── create-cat-tipo-alerta.dto.ts
        ├── update-cat-tipo-alerta.dto.ts
        └── update-cat-tipo-alerta-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-alerta.dto.ts

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

export class CreateCatTipoAlertaDto {
  @ApiProperty({
    description: 'Nombre del tipo de alerta',
    example: 'Exceso de velocidad',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del tipo de alerta',
    example: 'Se activa cuando el vehículo supera el límite de velocidad configurado',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    description: 'Nombre o ruta del ícono para la UI',
    example: 'speed',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icono?: string;

  @ApiProperty({
    description: 'Severidad (1=Info, 2=Advertencia, 3=Crítica)',
    example: 2,
    required: false,
    enum: [1, 2, 3],
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  severidad?: number = 1;

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

### update-cat-tipo-alerta.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoAlertaDto } from './create-cat-tipo-alerta.dto';

export class UpdateCatTipoAlertaDto extends PartialType(
  CreateCatTipoAlertaDto,
) {}
```

### update-cat-tipo-alerta-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoAlertaEstatusDto {
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

**Archivo:** `src/cat-tipo-alerta/cat-tipo-alerta.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Configurar según el módulo Alertas o similar. Revisar tabla `Modulos` en BD.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-alerta/cat-tipo-alerta.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Alerta')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Alertas)
- `@Controller('cat-tipo-alerta')`

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

**Archivo:** `src/cat-tipo-alerta/cat-tipo-alerta.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoAlerta } from 'src/entities/CatTipoAlerta';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoAlertaController } from './cat-tipo-alerta.controller';
import { CatTipoAlertaService } from './cat-tipo-alerta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoAlerta]),
    BitacoraModule,
  ],
  controllers: [CatTipoAlertaController],
  providers: [CatTipoAlertaService],
  exports: [CatTipoAlertaService],
})
export class CatTipoAlertaModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoAlertaModule } from './cat-tipo-alerta/cat-tipo-alerta.module';

// ...
CatTipoAlertaModule,
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
| Severidad | 1=Info, 2=Advertencia, 3=Crítica |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-alerta/list?soloActivos=true`
- `GET /api/cat-tipo-alerta/:page/:limit`
- `GET /api/cat-tipo-alerta/:id`
- `POST /api/cat-tipo-alerta/`
- `PATCH /api/cat-tipo-alerta/:id`
- `PATCH /api/cat-tipo-alerta/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de alertas del sistema (exceso de velocidad, motor encendido, batería baja, etc.) con su severidad e ícono para la UI. Es referenciado por el módulo de Alertas (Fase 2). Configurar el `IdModulo` de Bitácora según el módulo Alertas cuando esté implementado.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.4 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)

*Documento de referencia para implementar el catálogo CatTipoAlerta en NextAPI.*

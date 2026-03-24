# Flujo: Crear módulo de catálogo CatTipoLicencia

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoLicencia** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Este catálogo es requerido para el **LicenciasModule** (Fase 1). La tabla ya existe en BD con datos (Tipo A, B, C, D, E, Federal).

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoLicencia` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo sin FK ni timestamps. Incluye `Descripcion` opcional. Se usa para tipos de licencia de conducir (Tipo A, B, C, D, E, Federal).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoLicencia

**Archivo:** `src/entities/CatTipoLicencia.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoLicencia_Estatus', ['estatus'])
@Entity('CatTipoLicencia')
export class CatTipoLicencia {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
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
│   └── CatTipoLicencia.ts
└── cat-tipo-licencia/
    ├── cat-tipo-licencia.module.ts
    ├── cat-tipo-licencia.controller.ts
    ├── cat-tipo-licencia.service.ts
    └── dto/
        ├── create-cat-tipo-licencia.dto.ts
        ├── update-cat-tipo-licencia.dto.ts
        └── update-cat-tipo-licencia-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-licencia.dto.ts

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

export class CreateCatTipoLicenciaDto {
  @ApiProperty({
    description: 'Nombre del tipo de licencia',
    example: 'Tipo A - Automovilista',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del tipo de licencia',
    example: 'Vehículos particulares',
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

### update-cat-tipo-licencia.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoLicenciaDto } from './create-cat-tipo-licencia.dto';

export class UpdateCatTipoLicenciaDto extends PartialType(
  CreateCatTipoLicenciaDto,
) {}
```

### update-cat-tipo-licencia-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoLicenciaEstatusDto {
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

**Archivo:** `src/cat-tipo-licencia/cat-tipo-licencia.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar `ID_MODULO_LICENCIAS = 19` (CatTipoLicencia es atributo del módulo Licencias). El módulo ya existe en la tabla `Modulos`.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-licencia/cat-tipo-licencia.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Licencia')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Licencias)
- `@Controller('cat-tipo-licencia')`

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

**Archivo:** `src/cat-tipo-licencia/cat-tipo-licencia.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoLicencia } from 'src/entities/CatTipoLicencia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoLicenciaController } from './cat-tipo-licencia.controller';
import { CatTipoLicenciaService } from './cat-tipo-licencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoLicencia]),
    BitacoraModule,
  ],
  controllers: [CatTipoLicenciaController],
  providers: [CatTipoLicenciaService],
  exports: [CatTipoLicenciaService],
})
export class CatTipoLicenciaModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoLicenciaModule } from './cat-tipo-licencia/cat-tipo-licencia.module';

// ...
CatTipoLicenciaModule,
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
| IdModulo Bitácora | 19 (Licencias) |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-licencia/list?soloActivos=true`
- `GET /api/cat-tipo-licencia/:page/:limit`
- `GET /api/cat-tipo-licencia/:id`
- `POST /api/cat-tipo-licencia/`
- `PATCH /api/cat-tipo-licencia/:id`
- `PATCH /api/cat-tipo-licencia/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de licencia de conducir (Tipo A–E, Federal). Es referenciado por el módulo de Licencias cuando se registra cada licencia de un operador.

**Datos en BD (referencia):**
- Tipo A - Automovilista — Vehículos particulares
- Tipo B - Camiones — Transporte de carga
- Tipo C - Transporte Público — Pasajeros y transporte público
- Tipo D - Motocicleta — Motocicletas
- Tipo E - Especial — Vehículos especiales y maquinaria
- Federal — Licencia federal de conductor

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.6 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo), 4.2 (LicenciasModule)
- `docs/RESUMEN-BD-Next20260309.md` — CatTipoLicencia en BD (pendiente API)

*Documento de referencia para implementar el catálogo CatTipoLicencia en NextAPI.*

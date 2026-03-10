# Flujo: Crear módulo de catálogo CatTipoDispositivo

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoDispositivo** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoDispositivo` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo sin FK ni timestamps. Incluye `Descripcion` opcional. Se usa para tipos de dispositivos GPS (GT06, Teltonika, Concox, Queclink, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoDispositivo

**Archivo:** `src/entities/CatTipoDispositivo.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoDispositivo_Estatus', ['estatus'])
@Entity('CatTipoDispositivo')
export class CatTipoDispositivo {
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
│   └── CatTipoDispositivo.ts
└── cat-tipo-dispositivo/
    ├── cat-tipo-dispositivo.module.ts
    ├── cat-tipo-dispositivo.controller.ts
    ├── cat-tipo-dispositivo.service.ts
    └── dto/
        ├── create-cat-tipo-dispositivo.dto.ts
        ├── update-cat-tipo-dispositivo.dto.ts
        └── update-cat-tipo-dispositivo-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-dispositivo.dto.ts

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

export class CreateCatTipoDispositivoDto {
  @ApiProperty({
    description: 'Nombre del tipo de dispositivo',
    example: 'GT06',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del tipo de dispositivo',
    example: 'Dispositivo GPS compatible con protocolo GT06',
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

### update-cat-tipo-dispositivo.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoDispositivoDto } from './create-cat-tipo-dispositivo.dto';

export class UpdateCatTipoDispositivoDto extends PartialType(
  CreateCatTipoDispositivoDto,
) {}
```

### update-cat-tipo-dispositivo-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoDispositivoEstatusDto {
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

**Archivo:** `src/cat-tipo-dispositivo/cat-tipo-dispositivo.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar `ID_MODULO_DISPOSITIVOS = 15` (CatTipoDispositivo es atributo de dispositivos GPS). Revisar tabla `Modulos` en BD si se requiere otro valor.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-dispositivo/cat-tipo-dispositivo.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Dispositivo')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Dispositivos)
- `@Controller('cat-tipo-dispositivo')`

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

**Archivo:** `src/cat-tipo-dispositivo/cat-tipo-dispositivo.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoDispositivoController } from './cat-tipo-dispositivo.controller';
import { CatTipoDispositivoService } from './cat-tipo-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatTipoDispositivoController],
  providers: [CatTipoDispositivoService],
  exports: [CatTipoDispositivoService],
})
export class CatTipoDispositivoModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoDispositivoModule } from './cat-tipo-dispositivo/cat-tipo-dispositivo.module';

// ...
CatTipoDispositivoModule,
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
| IdModulo Bitácora | 15 (Dispositivos) |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-dispositivo/list?soloActivos=true`
- `GET /api/cat-tipo-dispositivo/:page/:limit`
- `GET /api/cat-tipo-dispositivo/:id`
- `POST /api/cat-tipo-dispositivo/`
- `PATCH /api/cat-tipo-dispositivo/:id`
- `PATCH /api/cat-tipo-dispositivo/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de dispositivos GPS (GT06, Teltonika, Concox, Queclink, etc.). Es referenciado por el módulo de Dispositivos para clasificar cada unidad según su protocolo o fabricante.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.4 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)

*Documento de referencia para implementar el catálogo CatTipoDispositivo en NextAPI.*

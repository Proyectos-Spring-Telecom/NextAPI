# Flujo: Crear módulo de catálogo CatMarcaDispositivo

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatMarcaDispositivo** en NextAPI, siguiendo las convenciones del proyecto.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatMarcaDispositivo` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `SitioWeb` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_CatMarcaDispositivo_Nombre` (`Nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo simple sin FK ni timestamps. Incluye campo opcional `SitioWeb`. Tiene restricción UNIQUE en `Nombre`. Es referenciado por la tabla `Dispositivos` (IdMarcaDispositivo).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatMarcaDispositivo

**Archivo:** `src/entities/CatMarcaDispositivo.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_CatMarcaDispositivo_Nombre', ['nombre'], { unique: true })
@Index('IX_CatMarcaDispositivo_Estatus', ['estatus'])
@Entity('CatMarcaDispositivo')
export class CatMarcaDispositivo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'SitioWeb', length: 255, nullable: true })
  sitioWeb: string | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── CatMarcaDispositivo.ts
└── cat-marca-dispositivo/
    ├── cat-marca-dispositivo.module.ts
    ├── cat-marca-dispositivo.controller.ts
    ├── cat-marca-dispositivo.service.ts
    └── dto/
        ├── create-cat-marca-dispositivo.dto.ts
        ├── update-cat-marca-dispositivo.dto.ts
        └── update-cat-marca-dispositivo-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-marca-dispositivo.dto.ts

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

export class CreateCatMarcaDispositivoDto {
  @ApiProperty({
    description: 'Nombre de la marca',
    example: 'Teltonika',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'URL del sitio web del fabricante',
    example: 'https://teltonika-gps.com',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sitioWeb?: string;

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

### update-cat-marca-dispositivo.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatMarcaDispositivoDto } from './create-cat-marca-dispositivo.dto';

export class UpdateCatMarcaDispositivoDto extends PartialType(
  CreateCatMarcaDispositivoDto,
) {}
```

### update-cat-marca-dispositivo-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatMarcaDispositivoEstatusDto {
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

**Archivo:** `src/cat-marca-dispositivo/cat-marca-dispositivo.service.ts`

Responsabilidades:

- `create(dto, idUser)`: validar que `nombre` no exista (UNIQUE), crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, si se cambia `nombre` validar que no exista otro con ese nombre, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar el IdModulo del módulo Dispositivos (15).

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-marca-dispositivo/cat-marca-dispositivo.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Marca Dispositivo')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o según permisos del módulo Dispositivos)
- `@Controller('cat-marca-dispositivo')`

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

**Archivo:** `src/cat-marca-dispositivo/cat-marca-dispositivo.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatMarcaDispositivo } from 'src/entities/CatMarcaDispositivo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMarcaDispositivoController } from './cat-marca-dispositivo.controller';
import { CatMarcaDispositivoService } from './cat-marca-dispositivo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatMarcaDispositivo]),
    BitacoraModule,
  ],
  controllers: [CatMarcaDispositivoController],
  providers: [CatMarcaDispositivoService],
  exports: [CatMarcaDispositivoService],
})
export class CatMarcaDispositivoModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatMarcaDispositivoModule } from './cat-marca-dispositivo/cat-marca-dispositivo.module';

// ...
CatMarcaDispositivoModule,
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
| Nombre único | Validar en create y update antes de guardar |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-marca-dispositivo/list?soloActivos=true`
- `GET /api/cat-marca-dispositivo/:page/:limit`
- `GET /api/cat-marca-dispositivo/:id`
- `POST /api/cat-marca-dispositivo/`
- `PUT /api/cat-marca-dispositivo/:id`
- `PATCH /api/cat-marca-dispositivo/estatus/:id`

---

## 11. Relación con Dispositivos

Este catálogo es referenciado por la tabla **Dispositivos** (campo `IdMarcaDispositivo`). Almacena las marcas de dispositivos GPS/tracking (ej: Teltonika, Queclink, Calamp, etc.) y su sitio web opcional. Se usa al implementar el módulo DispositivosModule.

---

*Documento de referencia para implementar el catálogo CatMarcaDispositivo en NextAPI.*

# Flujo: Crear módulo de catálogo CatTipoVehiculo

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoVehiculo** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Este catálogo es requerido para el **VehiculosModule**. La tabla ya existe en BD con 10 registros.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoVehiculo` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo mínimo sin FK ni timestamps. Solo incluye `Id`, `Nombre` y `Estatus`. Se usa para clasificar vehículos (sedán, camioneta, camión, motocicleta, autobús, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoVehiculo

**Archivo:** `src/entities/CatTipoVehiculo.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoVehiculo_Estatus', ['estatus'])
@Entity('CatTipoVehiculo')
export class CatTipoVehiculo {
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
│   └── CatTipoVehiculo.ts
└── cat-tipo-vehiculo/
    ├── cat-tipo-vehiculo.module.ts
    ├── cat-tipo-vehiculo.controller.ts
    ├── cat-tipo-vehiculo.service.ts
    └── dto/
        ├── create-cat-tipo-vehiculo.dto.ts
        ├── update-cat-tipo-vehiculo.dto.ts
        └── update-cat-tipo-vehiculo-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-vehiculo.dto.ts

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

export class CreateCatTipoVehiculoDto {
  @ApiProperty({
    description: 'Nombre del tipo de vehículo',
    example: 'Camioneta',
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

### update-cat-tipo-vehiculo.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoVehiculoDto } from './create-cat-tipo-vehiculo.dto';

export class UpdateCatTipoVehiculoDto extends PartialType(
  CreateCatTipoVehiculoDto,
) {}
```

### update-cat-tipo-vehiculo-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoVehiculoEstatusDto {
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

**Archivo:** `src/cat-tipo-vehiculo/cat-tipo-vehiculo.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Usar `ID_MODULO_VEHICULOS = 16` (CatTipoVehiculo es atributo del módulo Vehículos). El módulo ya existe en la tabla `Modulos`.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-vehiculo/cat-tipo-vehiculo.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Vehículo')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Vehículos)
- `@Controller('cat-tipo-vehiculo')`

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

**Archivo:** `src/cat-tipo-vehiculo/cat-tipo-vehiculo.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoVehiculo } from 'src/entities/CatTipoVehiculo';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoVehiculoController } from './cat-tipo-vehiculo.controller';
import { CatTipoVehiculoService } from './cat-tipo-vehiculo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoVehiculo]),
    BitacoraModule,
  ],
  controllers: [CatTipoVehiculoController],
  providers: [CatTipoVehiculoService],
  exports: [CatTipoVehiculoService],
})
export class CatTipoVehiculoModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoVehiculoModule } from './cat-tipo-vehiculo/cat-tipo-vehiculo.module';

// ...
CatTipoVehiculoModule,
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

- `GET /api/cat-tipo-vehiculo/list?soloActivos=true`
- `GET /api/cat-tipo-vehiculo/:page/:limit`
- `GET /api/cat-tipo-vehiculo/:id`
- `POST /api/cat-tipo-vehiculo/`
- `PATCH /api/cat-tipo-vehiculo/:id`
- `PATCH /api/cat-tipo-vehiculo/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo clasifica tipos de vehículos (sedán, camioneta, camión, motocicleta, autobús, etc.). Es referenciado por el módulo de Vehículos cuando se registra cada unidad de la flota.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.4 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)
- `docs/RESUMEN-BD-Next20260309.md` — CatTipoVehiculo en BD (pendiente API)

*Documento de referencia para implementar el catálogo CatTipoVehiculo en NextAPI.*

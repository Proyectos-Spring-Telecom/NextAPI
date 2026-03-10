# Flujo: Crear módulo de catálogo CatReferenciaServicio

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatReferenciaServicio** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatReferenciaServicio` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo simple sin FK, sin timestamps y sin restricción UNIQUE en `Nombre`. Solo campos obligatorios: `Nombre` y `Estatus`. Se usa como referencia para tipos o categorías de servicio (ej: Mantenimiento preventivo, Correctivo, Inspección, etc.).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatReferenciaServicio

**Archivo:** `src/entities/CatReferenciaServicio.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatReferenciaServicio_Estatus', ['estatus'])
@Entity('CatReferenciaServicio')
export class CatReferenciaServicio {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
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
│   └── CatReferenciaServicio.ts
└── cat-referencia-servicio/
    ├── cat-referencia-servicio.module.ts
    ├── cat-referencia-servicio.controller.ts
    ├── cat-referencia-servicio.service.ts
    └── dto/
        ├── create-cat-referencia-servicio.dto.ts
        ├── update-cat-referencia-servicio.dto.ts
        └── update-cat-referencia-servicio-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-referencia-servicio.dto.ts

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

export class CreateCatReferenciaServicioDto {
  @ApiProperty({
    description: 'Nombre de la referencia de servicio',
    example: 'Mantenimiento preventivo',
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

### update-cat-referencia-servicio.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatReferenciaServicioDto } from './create-cat-referencia-servicio.dto';

export class UpdateCatReferenciaServicioDto extends PartialType(
  CreateCatReferenciaServicioDto,
) {}
```

### update-cat-referencia-servicio-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatReferenciaServicioEstatusDto {
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

**Archivo:** `src/cat-referencia-servicio/cat-referencia-servicio.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Configurar según el módulo que consuma este catálogo (ej: Mantenimiento, Servicios, etc.). Revisar tabla `Modulos` en BD.

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-referencia-servicio/cat-referencia-servicio.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Referencia Servicio')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo que lo consuma)
- `@Controller('cat-referencia-servicio')`

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

**Archivo:** `src/cat-referencia-servicio/cat-referencia-servicio.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatReferenciaServicio } from 'src/entities/CatReferenciaServicio';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatReferenciaServicioController } from './cat-referencia-servicio.controller';
import { CatReferenciaServicioService } from './cat-referencia-servicio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatReferenciaServicio]),
    BitacoraModule,
  ],
  controllers: [CatReferenciaServicioController],
  providers: [CatReferenciaServicioService],
  exports: [CatReferenciaServicioService],
})
export class CatReferenciaServicioModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatReferenciaServicioModule } from './cat-referencia-servicio/cat-referencia-servicio.module';

// ...
CatReferenciaServicioModule,
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

- `GET /api/cat-referencia-servicio/list?soloActivos=true`
- `GET /api/cat-referencia-servicio/:page/:limit`
- `GET /api/cat-referencia-servicio/:id`
- `POST /api/cat-referencia-servicio/`
- `PATCH /api/cat-referencia-servicio/:id`
- `PATCH /api/cat-referencia-servicio/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena referencias o tipos de servicio (ej: Mantenimiento preventivo, Correctivo, Inspección, Diagnóstico). Puede ser referenciado por tablas de órdenes de servicio, mantenimiento o tickets. Configurar el `IdModulo` de Bitácora según el módulo principal que lo consuma.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.4 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo)

*Documento de referencia para implementar el catálogo CatReferenciaServicio en NextAPI.*

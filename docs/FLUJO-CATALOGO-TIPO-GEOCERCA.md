# Flujo: Crear módulo de catálogo CatTipoGeocerca

Este documento describe el flujo paso a paso para implementar el módulo de catálogo **CatTipoGeocerca** en NextAPI, siguiendo las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Este catálogo pertenece a **Fase 2** (Alertas y Geocercas). La tabla ya existe en BD con datos (Circular, Poligonal, Ruta/Corredor).

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `CatTipoGeocerca` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Nota:** Catálogo sin FK ni timestamps. Incluye `Descripcion` opcional. Se usa para tipos de geocercas (Circular, Poligonal, Ruta/Corredor).

### 1.2 Dependencias

Este catálogo **no tiene dependencias**. Puede implementarse de forma independiente.

---

## 2. Paso 1: Entidad CatTipoGeocerca

**Archivo:** `src/entities/CatTipoGeocerca.ts`

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoGeocerca_Estatus', ['estatus'])
@Entity('CatTipoGeocerca')
export class CatTipoGeocerca {
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
│   └── CatTipoGeocerca.ts
└── cat-tipo-geocerca/
    ├── cat-tipo-geocerca.module.ts
    ├── cat-tipo-geocerca.controller.ts
    ├── cat-tipo-geocerca.service.ts
    └── dto/
        ├── create-cat-tipo-geocerca.dto.ts
        ├── update-cat-tipo-geocerca.dto.ts
        └── update-cat-tipo-geocerca-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-cat-tipo-geocerca.dto.ts

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

export class CreateCatTipoGeocercaDto {
  @ApiProperty({
    description: 'Nombre del tipo de geocerca',
    example: 'Circular',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del tipo de geocerca',
    example: 'Geocerca definida por un punto central y un radio',
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

### update-cat-tipo-geocerca.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoGeocercaDto } from './create-cat-tipo-geocerca.dto';

export class UpdateCatTipoGeocercaDto extends PartialType(
  CreateCatTipoGeocercaDto,
) {}
```

### update-cat-tipo-geocerca-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateCatTipoGeocercaEstatusDto {
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

**Archivo:** `src/cat-tipo-geocerca/cat-tipo-geocerca.service.ts`

Responsabilidades:

- `create(dto, idUser)`: crear registro, Bitácora (SUCCESS/ERROR).
- `findAllList(soloActivos?)`: lista completa, opcional `where: { estatus: 1 }`.
- `findAll(page, limit, soloActivos?)`: paginado con `findAndCount`.
- `findOne(id)`: por ID, `NotFoundException` si no existe.
- `update(id, dto, idUser)`: validar existencia, actualizar, Bitácora.
- `updateEstatus(id, dto, idUser)`: cambiar estatus, Bitácora (soft delete).

**Bitácora:** usar `BitacoraLoggerService.logToBitacora(modulo, descripcion, accion, query, idUsuario, idModulo, estatus, error)`.

**IdModulo:** Crear registro en tabla `Modulos` para Geocercas (Fase 2) antes de usar. Ejemplo: `INSERT INTO Modulos (Nombre, Descripción, Estatus) VALUES ('Geocercas', 'Gestión de geocercas y zonas geográficas', 1);` — usar el `Id` generado (p. ej. 22). Definir `ID_MODULO_GEOCERCAS = 22` o el Id correspondiente. Si aún no existe el módulo, usar `null` en Bitácora (IdModulo acepta NULL).

---

## 6. Paso 5: Controller

**Archivo:** `src/cat-tipo-geocerca/cat-tipo-geocerca.controller.ts`

Convenciones NextAPI:

- `@ApiTags('Catálogo Tipo Geocerca')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (CONTRATO 6.2, CONTEXTO 4.1; o según permisos del módulo Geocercas)
- `@Controller('cat-tipo-geocerca')`

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

**Archivo:** `src/cat-tipo-geocerca/cat-tipo-geocerca.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoGeocerca } from 'src/entities/CatTipoGeocerca';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoGeocercaController } from './cat-tipo-geocerca.controller';
import { CatTipoGeocercaService } from './cat-tipo-geocerca.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoGeocerca]),
    BitacoraModule,
  ],
  controllers: [CatTipoGeocercaController],
  providers: [CatTipoGeocercaService],
  exports: [CatTipoGeocercaService],
})
export class CatTipoGeocercaModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

Agregar en el array `imports`:

```typescript
import { CatTipoGeocercaModule } from './cat-tipo-geocerca/cat-tipo-geocerca.module';

// ...
CatTipoGeocercaModule,
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
| IdModulo Bitácora | Crear módulo Geocercas en BD (o usar null) |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/cat-tipo-geocerca/list?soloActivos=true`
- `GET /api/cat-tipo-geocerca/:page/:limit`
- `GET /api/cat-tipo-geocerca/:id`
- `POST /api/cat-tipo-geocerca/`
- `PATCH /api/cat-tipo-geocerca/:id`
- `PATCH /api/cat-tipo-geocerca/estatus/:id`

---

## 11. Uso del catálogo

Este catálogo almacena tipos de geocercas (Circular, Poligonal, Ruta/Corredor). Es referenciado por el módulo de Geocercas (Fase 2) para clasificar cada zona según su forma geométrica.

**Datos en BD (referencia):**
- Circular — Geocerca definida por un punto central y un radio
- Poligonal — Geocerca definida por un polígono de múltiples puntos
- Ruta / Corredor — Geocerca definida por una ruta con un ancho de tolerancia

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Sección 6 (Especificaciones API), 6.6 (Convenciones catálogos)
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.1 (Estructura estándar módulos de catálogo), 4.5 (Fase 2: Geocercas)

*Documento de referencia para implementar el catálogo CatTipoGeocerca en NextAPI.*

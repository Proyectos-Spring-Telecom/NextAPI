# Flujo: Crear módulo Dispositivos

Este documento describe el flujo paso a paso para implementar el módulo **Dispositivos** (dispositivos GPS) en NextAPI. Es una **entidad operativa** (no catálogo), con multitenancy y FKs a catálogos y Sims. Sigue las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Dispositivos es parte del dominio **Dispositivos GPS e IoT** (CONTEXTO 4.3). La tabla ya existe en BD. Cadena operativa: CatTelefonia → CatPlanesTelefonia → Sims → **Dispositivos** → Instalaciones → Vehiculos.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `Dispositivos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `NumeroSerie` varchar(100) NOT NULL COMMENT 'Número de serie / IMEI del dispositivo GPS',
  `IdModeloDispositivo` bigint NOT NULL COMMENT 'Modelo del dispositivo (contiene la marca)',
  `IdTipoDispositivo` bigint NOT NULL COMMENT 'Tipo: vehicular, personal, OBD-II, activos',
  `IdEstatusDispositivo` bigint NOT NULL DEFAULT '1' COMMENT 'Estatus actual del dispositivo',
  `IdSim` bigint NOT NULL COMMENT 'SIM asignado al dispositivo (NULL = sin SIM)',
  `IdCliente` bigint NOT NULL COMMENT 'Cliente/tenant propietario del dispositivo',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Dispositivos_NumeroSerie` (`NumeroSerie`),
  UNIQUE KEY `UQ_Dispositivos_IdCliente_Id` (`IdCliente`,`Id`),
  UNIQUE KEY `UQ_Dispositivos_IdSim` (`IdSim`),
  KEY `IX_Dispositivos_IdCliente_IdEstatusDispositivo` (`IdCliente`,`IdEstatusDispositivo`),
  KEY `FK_Dispositivos_ModeloDispositivo` (`IdModeloDispositivo`),
  KEY `FK_Dispositivos_TipoDispositivo` (`IdTipoDispositivo`),
  KEY `FK_Dispositivos_CatEstatusDispositivo` (`IdEstatusDispositivo`),
  CONSTRAINT `FK_Dispositivos_CatEstatusDispositivo` FOREIGN KEY (`IdEstatusDispositivo`) REFERENCES `CatEstatusDispositivo` (`Id`),
  CONSTRAINT `FK_Dispositivos_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Dispositivos_ModeloDispositivo` FOREIGN KEY (`IdModeloDispositivo`) REFERENCES `CatModeloDispositivo` (`Id`),
  CONSTRAINT `FK_Dispositivos_Sim` FOREIGN KEY (`IdSim`) REFERENCES `Sims` (`Id`),
  CONSTRAINT `FK_Dispositivos_TipoDispositivo` FOREIGN KEY (`IdTipoDispositivo`) REFERENCES `CatTipoDispositivo` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

```

**Características:**

- **Multitenancy:** `IdCliente` obligatorio; todas las operaciones filtran por tenant (JWT).
- **Unique:** `NumeroSerie` único global; `IdSim` único global (un SIM solo puede estar en un dispositivo).
- **FKs obligatorios:** IdModeloDispositivo, IdTipoDispositivo, IdEstatusDispositivo, IdCliente, IdSim.
- **Timestamps:** FechaCreacion, FechaActualizacion (manejados por BD o TypeORM).
- **Soft delete:** Campo `Estatus` (1=Activo, 0=Inactivo).

**Nota:** Si se asigna IdSim, el SIM debe pertenecer al mismo IdCliente. IdSim único implica que un SIM no puede estar en dos dispositivos.

### 1.2 Dependencias

| Entidad | Uso |
|---------|-----|
| Clientes | IdCliente (tenant) — desde JWT |
| CatModeloDispositivo | IdModeloDispositivo |
| CatTipoDispositivo | IdTipoDispositivo |
| CatEstatusDispositivo | IdEstatusDispositivo (default 1) |
| Sims | IdSim (opcional; si se asigna, debe existir y pertenecer al mismo cliente) |

---

## 2. Paso 1: Entidad Dispositivos

**Archivo:** `src/entities/Dispositivos.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { CatModeloDispositivo } from './CatModeloDispositivo';
import { CatTipoDispositivo } from './CatTipoDispositivo';
import { CatEstatusDispositivo } from './CatEstatusDispositivo';
import { Sims } from './Sims';

@applySchema
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_IdSim', ['idSim'], { unique: true })
@Index('IX_Dispositivos_IdCliente_IdEstatusDispositivo', [
  'idCliente',
  'idEstatusDispositivo',
])
@Index('IX_Dispositivos_IdModeloDispositivo', ['idModeloDispositivo'])
@Index('IX_Dispositivos_IdTipoDispositivo', ['idTipoDispositivo'])
@Index('IX_Dispositivos_Estatus', ['estatus'])
@Entity('Dispositivos')
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NumeroSerie', length: 100 })
  numeroSerie: string;

  @Column('bigint', { name: 'IdModeloDispositivo' })
  idModeloDispositivo: number;

  @Column('bigint', { name: 'IdTipoDispositivo' })
  idTipoDispositivo: number;

  @Column('bigint', { name: 'IdEstatusDispositivo', default: 1 })
  idEstatusDispositivo: number;

  @Column('bigint', { name: 'IdSim' })
  idSim: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatModeloDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdModeloDispositivo', referencedColumnName: 'id' }])
  idModeloDispositivo2: CatModeloDispositivo;

  @ManyToOne(() => CatTipoDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdTipoDispositivo', referencedColumnName: 'id' }])
  idTipoDispositivo2: CatTipoDispositivo;

  @ManyToOne(() => CatEstatusDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEstatusDispositivo', referencedColumnName: 'id' }])
  idEstatusDispositivo2: CatEstatusDispositivo;

  @ManyToOne(() => Sims, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdSim', referencedColumnName: 'id' }])
  idSim2: Sims | null;
}
```

**Nota:** TypeORM no permite índice unique en columna nullable en algunos casos. Si `UQ_Dispositivos_IdSim` da problemas (varios NULL), la BD permite múltiples NULL en unique; verificar comportamiento de TypeORM.

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── Dispositivos.ts
└── dispositivos/
    ├── dispositivos.module.ts
    ├── dispositivos.controller.ts
    ├── dispositivos.service.ts
    └── dto/
        ├── create-dispositivos.dto.ts
        ├── update-dispositivos.dto.ts
        └── update-dispositivos-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-dispositivos.dto.ts

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

export class CreateDispositivosDto {
  @ApiProperty({
    description: 'Número de serie / IMEI del dispositivo GPS',
    example: '353456789012345',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroSerie: string;

  @ApiProperty({ description: 'ID modelo (CatModeloDispositivo)' })
  @IsInt()
  @IsNotEmpty()
  idModeloDispositivo: number;

  @ApiProperty({ description: 'ID tipo (CatTipoDispositivo)' })
  @IsInt()
  @IsNotEmpty()
  idTipoDispositivo: number;

  @ApiProperty({
    description: 'ID estatus (CatEstatusDispositivo)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  idEstatusDispositivo?: number = 1;

  @ApiProperty({
    description: 'ID SIM asignado',
    required: true,
  })
  @IsNotEmpty()
  @IsInt()
  idSim: number;

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

**Nota:** `IdCliente` **no** se envía en el DTO; se obtiene de `req.user.idCliente` (JWT).

### update-dispositivos.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateDispositivosDto } from './create-dispositivos.dto';

export class UpdateDispositivosDto extends PartialType(CreateDispositivosDto) {}
```

### update-dispositivos-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateDispositivosEstatusDto {
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

**Archivo:** `src/dispositivos/dispositivos.service.ts`

Responsabilidades:

- **Multitenancy:** Todas las operaciones filtran por `idCliente` (del JWT).
- `create(dto, idCliente, idUser)`: validar NumeroSerie único, validar IdSim único si se asigna, validar que IdSim pertenezca al cliente, validar FKs, crear, Bitácora.
- `findAllList(idCliente, soloActivos?)`: lista completa del tenant.
- `findAll(idCliente, page, limit, soloActivos?)`: paginado del tenant.
- `findOne(id, idCliente)`: por ID, validar pertenencia al tenant.
- `update(id, dto, idCliente, idUser)`: validar pertenencia, NumeroSerie único si cambia, IdSim único y del cliente si cambia, validar FKs, Bitácora.
- `updateEstatus(id, dto, idCliente, idUser)`: cambiar Estatus, Bitácora.

**Validaciones:**

- NumeroSerie único a nivel global.
- Si IdSim se asigna: debe existir, pertenecer al mismo IdCliente, y no estar asignado a otro dispositivo (IdSim único).
- IdModeloDispositivo, IdTipoDispositivo, IdEstatusDispositivo deben existir en sus catálogos.
- IdCliente se inyecta desde JWT, no desde el body.

**Bitácora:** `BitacoraLoggerService.logToBitacora('Dispositivos', descripcion, accion, query, idUsuario, ID_MODULO_DISPOSITIVOS, estatus, error)`.

**IdModulo:** `ID_MODULO_DISPOSITIVOS = 15` (módulo Dispositivos en tabla Modulos).

---

## 6. Paso 5: Controller

**Archivo:** `src/dispositivos/dispositivos.controller.ts`

Convenciones:

- `@ApiTags('Dispositivos')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o permisos del módulo Dispositivos)
- `@Controller('dispositivos')`

**Multitenancy:** En cada ruta obtener `idCliente` de `req.user.idCliente` y pasarlo al service.

**Rutas (orden crítico para NestJS):**

| Método | Ruta | Método Service |
|--------|------|----------------|
| GET | `/list` | findAllList(idCliente, soloActivos) |
| GET | `/:page/:limit` | findAll(idCliente, page, limit, soloActivos) |
| GET | `/:id` | findOne(id, idCliente) |
| POST | `/` | create(dto, idCliente, req.user.userId) |
| PATCH | `/:id` | update(id, dto, idCliente, req.user.userId) |
| PATCH | `estatus/:id` | updateEstatus(id, dto, idCliente, req.user.userId) |

---

## 7. Paso 6: Module

**Archivo:** `src/dispositivos/dispositivos.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatModeloDispositivo } from 'src/entities/CatModeloDispositivo';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { CatEstatusDispositivo } from 'src/entities/CatEstatusDispositivo';
import { Sims } from 'src/entities/Sims';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispositivos,
      CatModeloDispositivo,
      CatTipoDispositivo,
      CatEstatusDispositivo,
      Sims,
    ]),
    BitacoraModule,
  ],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

```typescript
import { DispositivosModule } from './dispositivos/dispositivos.module';

// En imports:
DispositivosModule,
```

---

## 9. Resumen de convenciones

| Elemento | Valor |
|----------|-------|
| applySchema | Default: `Next` |
| ApiBearerAuth | `'bearer-token'` |
| Guards | JwtAuthGuard + RolesGuard + @Roles() |
| Multitenancy | IdCliente desde req.user.idCliente |
| NumeroSerie | Unique global |
| IdSim | Unique global (un SIM = un dispositivo); opcional |
| Rutas estatus | PATCH /estatus/:id |
| DELETE | Soft delete vía PATCH estatus |
| Bitácora | En create, update, updateEstatus |
| IdModulo Bitácora | 15 (Dispositivos) |
| Paginación | GET /list + GET /:page/:limit |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/dispositivos/list?soloActivos=true`
- `GET /api/dispositivos/:page/:limit`
- `GET /api/dispositivos/:id`
- `POST /api/dispositivos/`
- `PATCH /api/dispositivos/:id`
- `PATCH /api/dispositivos/estatus/:id`

---

## 11. Uso del módulo

Dispositivos almacena los equipos GPS (rastreadores, OBD-II, etc.) de cada cliente. Cada dispositivo tiene modelo, tipo, estatus y opcionalmente un SIM. Se vinculan a vehículos mediante el módulo Instalaciones.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Especificaciones API, convenciones
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.3 (Dispositivos GPS e IoT), 7.2 (Relaciones)
- `docs/FLUJO-MODULO-SIMS.md` — Módulo Sims (entidad relacionada)

*Documento de referencia para implementar el módulo Dispositivos en NextAPI.*

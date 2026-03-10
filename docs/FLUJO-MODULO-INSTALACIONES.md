# Flujo: Crear módulo Instalaciones

Este documento describe el flujo paso a paso para implementar el módulo **Instalaciones** (vinculación dispositivo–vehículo) en NextAPI. Es una **entidad operativa** (no catálogo), con multitenancy y FKs compuestas a Dispositivos y Vehiculos. Sigue las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Instalaciones es parte del dominio **Dispositivos GPS e IoT** (CONTEXTO 4.3). La tabla ya existe en BD. Cadena operativa: CatTelefonia → CatPlanesTelefonia → Sims → Dispositivos → **Instalaciones** → Vehiculos.

**Dependencia crítica:** Requiere que **VehiculosModule** (o al menos la entidad Vehiculos) esté implementado, ya que la FK compuesta referencia `Vehiculos(IdCliente, Id)`.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `Instalaciones` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL COMMENT 'FK → Clientes.Id (multitenancy)',
  `IdDispositivo` bigint NOT NULL COMMENT 'FK compuesta → Dispositivos (IdCliente, Id)',
  `IdVehiculo` bigint NOT NULL COMMENT 'FK compuesta → Vehiculos (IdCliente, Id)',
  `IdActivos` bigint DEFAULT NULL COMMENT 'FK compuesta → Activos (IdCliente, Id) — pendiente',
  `IdPortatiles` bigint DEFAULT NULL COMMENT 'FK compuesta → Portatiles (IdCliente, Id) — pendiente',
  `IdEstatusInstalacion` bigint NOT NULL DEFAULT '1' COMMENT 'FK → CatEstatusInstalacion.Id',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Instalaciones_IdCliente_IdVehiculo` (`IdCliente`,`IdVehiculo`),
  UNIQUE KEY `UQ_Instalaciones_IdCliente_IdDispositivo` (`IdCliente`,`IdDispositivo`),
  KEY `IX_Instalaciones_IdCliente_IdEstatusInstalacion` (`IdCliente`,`IdEstatusInstalacion`),
  CONSTRAINT `FK_Instalaciones_CatEstatusInstalacion` FOREIGN KEY (`IdEstatusInstalacion`) REFERENCES `CatEstatusInstalacion` (`Id`),
  CONSTRAINT `FK_Instalaciones_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Instalaciones_Dispositivo_Cliente` FOREIGN KEY (`IdCliente`, `IdDispositivo`) REFERENCES `Dispositivos` (`IdCliente`, `Id`),
  CONSTRAINT `FK_Instalaciones_Vehiculo_Cliente` FOREIGN KEY (`IdCliente`, `IdVehiculo`) REFERENCES `Vehiculos` (`IdCliente`, `Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Características:**

- **Multitenancy:** `IdCliente` obligatorio; todas las operaciones filtran por tenant (JWT).
- **Unicidad:** Un vehículo solo puede tener una instalación; un dispositivo solo puede estar en una instalación.
- **FKs compuestas:** IdDispositivo e IdVehiculo se validan con IdCliente (ambos deben pertenecer al mismo tenant).
- **FKs opcionales (pendiente):** IdActivos, IdPortatiles — tablas Activos y Portatiles no existen aún; columnas nullable.
- **Timestamps:** FechaCreacion, FechaActualizacion (manejados por BD o TypeORM).
- **Soft delete:** Campo `Estatus` (1=Activo, 0=Inactivo).

### 1.2 Dependencias

| Entidad | Uso |
|---------|-----|
| Clientes | IdCliente (tenant) — desde JWT |
| Dispositivos | IdDispositivo — debe existir y pertenecer al mismo IdCliente |
| Vehiculos | IdVehiculo — debe existir y pertenecer al mismo IdCliente |
| CatEstatusInstalacion | IdEstatusInstalacion (default 1) |

---

## 2. Paso 1: Entidad Instalaciones

**Archivo:** `src/entities/Instalaciones.ts`

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
import { Dispositivos } from './Dispositivos';
import { Vehiculos } from './Vehiculos';
import { CatEstatusInstalacion } from './CatEstatusInstalacion';

@applySchema
@Index('UQ_Instalaciones_IdCliente_IdVehiculo', ['idCliente', 'idVehiculo'], {
  unique: true,
})
@Index('UQ_Instalaciones_IdCliente_IdDispositivo', [
  'idCliente',
  'idDispositivo',
], { unique: true })
@Index('IX_Instalaciones_IdCliente_IdEstatusInstalacion', [
  'idCliente',
  'idEstatusInstalacion',
])
@Index('IX_Instalaciones_Estatus', ['estatus'])
@Entity('Instalaciones')
export class Instalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('bigint', { name: 'IdVehiculo' })
  idVehiculo: number;

  @Column('bigint', { name: 'IdActivos', nullable: true })
  idActivos: number | null;

  @Column('bigint', { name: 'IdPortatiles', nullable: true })
  idPortatiles: number | null;

  @Column('bigint', { name: 'IdEstatusInstalacion', default: 1 })
  idEstatusInstalacion: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Dispositivos, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos;

  @ManyToOne(() => Vehiculos, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdVehiculo', referencedColumnName: 'id' },
  ])
  idVehiculo2: Vehiculos;

  @ManyToOne(() => CatEstatusInstalacion, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEstatusInstalacion', referencedColumnName: 'id' }])
  idEstatusInstalacion2: CatEstatusInstalacion;
}
```

**Nota:** Las relaciones a Dispositivos y Vehiculos usan FKs compuestas `(IdCliente, IdDispositivo)` y `(IdCliente, IdVehiculo)`. Las tablas Dispositivos y Vehiculos deben tener índice único en `(IdCliente, Id)`.

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── Instalaciones.ts
└── instalaciones/
    ├── instalaciones.module.ts
    ├── instalaciones.controller.ts
    ├── instalaciones.service.ts
    └── dto/
        ├── create-instalaciones.dto.ts
        ├── update-instalaciones.dto.ts
        └── update-instalaciones-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-instalaciones.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({ description: 'ID dispositivo (debe pertenecer al mismo cliente)' })
  @IsInt()
  @IsNotEmpty()
  idDispositivo: number;

  @ApiProperty({ description: 'ID vehículo (debe pertenecer al mismo cliente)' })
  @IsInt()
  @IsNotEmpty()
  idVehiculo: number;

  @ApiProperty({
    description: 'ID estatus (CatEstatusInstalacion)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  idEstatusInstalacion?: number = 1;

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

**Nota:** `IdCliente` se obtiene de `req.user.idCliente` (JWT). IdDispositivo e IdVehiculo deben pertenecer al mismo cliente.

### update-instalaciones.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateInstalacionesDto } from './create-instalaciones.dto';

export class UpdateInstalacionesDto extends PartialType(
  CreateInstalacionesDto,
) {}
```

### update-instalaciones-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateInstalacionesEstatusDto {
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

**Archivo:** `src/instalaciones/instalaciones.service.ts`

Responsabilidades:

- **Multitenancy:** Todas las operaciones filtran por `idCliente` (del JWT).
- `create(dto, idCliente, idUser)`: validar que IdDispositivo e IdVehiculo existan y pertenezcan al cliente; validar que ni el dispositivo ni el vehículo tengan ya una instalación activa; validar IdEstatusInstalacion; crear, Bitácora.
- `findAllList(idCliente, soloActivos?)`: lista completa del tenant.
- `findAll(idCliente, page, limit, soloActivos?)`: paginado del tenant.
- `findOne(id, idCliente)`: por ID, validar pertenencia al tenant.
- `update(id, dto, idCliente, idUser)`: validar pertenencia; si cambia IdDispositivo o IdVehiculo, validar unicidad; validar FKs; Bitácora.
- `updateEstatus(id, dto, idCliente, idUser)`: cambiar Estatus, Bitácora.

**Validaciones:**

- IdDispositivo debe existir en Dispositivos y tener idCliente = idCliente del JWT.
- IdVehiculo debe existir en Vehiculos y tener idCliente = idCliente del JWT.
- No puede haber otra instalación (activa) con el mismo IdDispositivo.
- No puede haber otra instalación (activa) con el mismo IdVehiculo.
- IdEstatusInstalacion debe existir en CatEstatusInstalacion.

**Bitácora:** `BitacoraLoggerService.logToBitacora('Instalaciones', descripcion, accion, query, idUsuario, ID_MODULO_INSTALACIONES, estatus, error)`.

**IdModulo:** `ID_MODULO_INSTALACIONES = 17` (módulo Instalaciones en tabla Modulos).

---

## 6. Paso 5: Controller

**Archivo:** `src/instalaciones/instalaciones.controller.ts`

Convenciones:

- `@ApiTags('Instalaciones')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o permisos del módulo Instalaciones)
- `@Controller('instalaciones')`

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

**Archivo:** `src/instalaciones/instalaciones.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { InstalacionesController } from './instalaciones.controller';
import { InstalacionesService } from './instalaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      Dispositivos,
      Vehiculos,
      CatEstatusInstalacion,
    ]),
    BitacoraModule,
  ],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
  exports: [InstalacionesService],
})
export class InstalacionesModule {}
```

**Nota:** Requiere que la entidad `Vehiculos` exista. Si VehiculosModule no está implementado, crear al menos la entidad Vehiculos.

---

## 8. Paso 7: Registro en app.module.ts

```typescript
import { InstalacionesModule } from './instalaciones/instalaciones.module';

// En imports:
InstalacionesModule,
```

---

## 9. Resumen de convenciones

| Elemento | Valor |
|----------|-------|
| applySchema | Default: `Next` |
| ApiBearerAuth | `'bearer-token'` |
| Guards | JwtAuthGuard + RolesGuard + @Roles() |
| Multitenancy | IdCliente desde req.user.idCliente |
| IdDispositivo + IdVehiculo | Únicos por tenant (1 dispositivo = 1 instalación, 1 vehículo = 1 instalación) |
| Rutas estatus | PATCH /estatus/:id |
| DELETE | Soft delete vía PATCH estatus |
| Bitácora | En create, update, updateEstatus |
| IdModulo Bitácora | 17 (Instalaciones) |
| Paginación | GET /list + GET /:page/:limit |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/instalaciones/list?soloActivos=true`
- `GET /api/instalaciones/:page/:limit`
- `GET /api/instalaciones/:id`
- `POST /api/instalaciones/`
- `PATCH /api/instalaciones/:id`
- `PATCH /api/instalaciones/estatus/:id`

---

## 11. Uso del módulo

Instalaciones vincula dispositivos GPS con vehículos (relación 1:1). Cada registro indica qué dispositivo está instalado en qué vehículo. Un dispositivo no puede estar en dos vehículos ni un vehículo tener dos dispositivos activos simultáneamente. El historial de cambios puede registrarse en HistoricoInstalaciones.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Especificaciones API, convenciones
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.3 (Dispositivos GPS e IoT), 7.2 (Relaciones)
- `docs/FLUJO-MODULO-DISPOSITIVOS.md` — Módulo Dispositivos (entidad relacionada)
- `docs/FLUJO-MODULO-SIMS.md` — Módulo Sims (cadena operativa)
- `docs/RESUMEN-BD-Next20260309.md` — Estado de tablas

*Documento de referencia para implementar el módulo Instalaciones en NextAPI.*

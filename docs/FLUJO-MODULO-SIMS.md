# Flujo: Crear módulo Sims

Este documento describe el flujo paso a paso para implementar el módulo **Sims** (tarjetas SIM) en NextAPI. Es una **entidad operativa** (no catálogo), con multitenancy y FKs a catálogos. Sigue las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Sims es parte del dominio **Dispositivos GPS e IoT** (CONTEXTO 4.3). La tabla ya existe en BD. Cadena operativa: CatTelefonia → CatPlanesTelefonia → **Sims** → Dispositivos → Instalaciones → Vehiculos.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `Sims` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `ICC` varchar(22) NOT NULL COMMENT 'Número de serie físico del SIM (ICCID, hasta 22 dígitos)',
  `IMEI` varchar(15) DEFAULT NULL COMMENT 'Identificador del suscriptor en la red móvil',
  `NumeroTelefono` varchar(20) DEFAULT NULL COMMENT 'Número de línea / MSISDN del SIM',
  `IPEstatica` varchar(45) DEFAULT NULL COMMENT 'IP fija asignada al SIM (IPv4 o IPv6, si aplica)',
  `IdTelefonia` bigint NOT NULL COMMENT 'Compañía telefónica del SIM',
  `IdPlanTelefonia` bigint NOT NULL COMMENT 'Plan de datos contratado',
  `IdCliente` bigint NOT NULL COMMENT 'Cliente/tenant propietario del SIM',
  `IdEstatusSim` bigint NOT NULL DEFAULT '1' COMMENT 'Estatus actual del SIM',
  `FechaActivacion` date DEFAULT NULL COMMENT 'Fecha en que se activó el SIM',
  `FechaVencimiento` date DEFAULT NULL COMMENT 'Fecha de vencimiento del servicio o plan',
  `Notas` varchar(500) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Estatus` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Sims_ICC` (`ICC`),
  KEY `IX_Sims_IdCliente_IdEstatusSim` (`IdCliente`,`IdEstatusSim`),
  KEY `IX_Sims_IdTelefonia` (`IdTelefonia`),
  KEY `IX_Sims_IdPlanTelefonia` (`IdPlanTelefonia`),
  CONSTRAINT `FK_Sims_CatEstatusSim` FOREIGN KEY (`IdEstatusSim`) REFERENCES `CatEstatusSim` (`Id`),
  CONSTRAINT `FK_Sims_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`),
  CONSTRAINT `FK_Sims_PlanTelefonia` FOREIGN KEY (`IdPlanTelefonia`) REFERENCES `CatPlanesTelefonia` (`Id`),
  CONSTRAINT `FK_Sims_Telefonia` FOREIGN KEY (`IdTelefonia`) REFERENCES `CatTelefonia` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Características:**

- **Multitenancy:** `IdCliente` obligatorio; todas las operaciones filtran por tenant (JWT).
- **Unique:** `ICC` único a nivel global (no se repite en todo el sistema).
- **FKs obligatorios:** IdTelefonia, IdPlanTelefonia, IdCliente, IdEstatusSim.
- **Opcionales:** IMEI, NumeroTelefono, IPEstatica, FechaActivacion, FechaVencimiento, Notas.
- **Timestamps:** FechaCreacion, FechaActualizacion (manejados por BD o TypeORM).
- **Soft delete:** Campo `Estatus` (1=Activo, 0=Inactivo).

### 1.2 Dependencias

| Entidad | Uso |
|---------|-----|
| Clientes | IdCliente (tenant) — desde JWT |
| CatTelefonia | IdTelefonia |
| CatPlanesTelefonia | IdPlanTelefonia |
| CatEstatusSim | IdEstatusSim (default 1) |

---

## 2. Paso 1: Entidad Sims

**Archivo:** `src/entities/Sims.ts`

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
import { CatTelefonia } from './CatTelefonia';
import { CatPlanesTelefonia } from './CatPlanesTelefonia';
import { CatEstatusSim } from './CatEstatusSim';

@applySchema
@Index('UQ_Sims_ICC', ['icc'], { unique: true })
@Index('IX_Sims_IdCliente_IdEstatusSim', ['idCliente', 'idEstatusSim'])
@Index('IX_Sims_IdTelefonia', ['idTelefonia'])
@Index('IX_Sims_IdPlanTelefonia', ['idPlanTelefonia'])
@Index('IX_Sims_IMEI', ['imei'])
@Index('IX_Sims_IPEstatica', ['ipEstatica'])
@Index('IX_Sims_Estatus', ['estatus'])
@Entity('Sims')
export class Sims {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'ICC', length: 22 })
  icc: string;

  @Column('varchar', { name: 'IMEI', length: 15, nullable: true })
  imei: string | null;

  @Column('varchar', { name: 'NumeroTelefono', length: 20, nullable: true })
  numeroTelefono: string | null;

  @Column('varchar', { name: 'IPEstatica', length: 45, nullable: true })
  ipEstatica: string | null;

  @Column('bigint', { name: 'IdTelefonia' })
  idTelefonia: number;

  @Column('bigint', { name: 'IdPlanTelefonia' })
  idPlanTelefonia: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdEstatusSim', default: 1 })
  idEstatusSim: number;

  @Column('date', { name: 'FechaActivacion', nullable: true })
  fechaActivacion: Date | null;

  @Column('date', { name: 'FechaVencimiento', nullable: true })
  fechaVencimiento: Date | null;

  @Column('varchar', { name: 'Notas', length: 500, nullable: true })
  notas: string | null;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatTelefonia, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdTelefonia', referencedColumnName: 'id' }])
  idTelefonia2: CatTelefonia;

  @ManyToOne(() => CatPlanesTelefonia, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdPlanTelefonia', referencedColumnName: 'id' }])
  idPlanTelefonia2: CatPlanesTelefonia;

  @ManyToOne(() => CatEstatusSim, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdEstatusSim', referencedColumnName: 'id' }])
  idEstatusSim2: CatEstatusSim;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── Sims.ts
└── sims/
    ├── sims.module.ts
    ├── sims.controller.ts
    ├── sims.service.ts
    └── dto/
        ├── create-sims.dto.ts
        ├── update-sims.dto.ts
        └── update-sims-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-sims.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSimsDto {
  @ApiProperty({ description: 'ICC/ICCID del SIM (hasta 22 dígitos)', example: '8944110000000000001', maxLength: 22 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(22)
  icc: string;

  @ApiProperty({ description: 'IMEI/identificador en red (opcional)', maxLength: 15, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  imei?: string;

  @ApiProperty({ description: 'Número de teléfono / MSISDN', maxLength: 20, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroTelefono?: string;

  @ApiProperty({ description: 'IP estática (IPv4 o IPv6)', maxLength: 45, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipEstatica?: string;

  @ApiProperty({ description: 'ID compañía telefónica (CatTelefonia)' })
  @IsInt()
  @IsNotEmpty()
  idTelefonia: number;

  @ApiProperty({ description: 'ID plan de datos (CatPlanesTelefonia)' })
  @IsInt()
  @IsNotEmpty()
  idPlanTelefonia: number;

  @ApiProperty({ description: 'ID estatus del SIM (CatEstatusSim)', default: 1, required: false })
  @IsOptional()
  @IsInt()
  idEstatusSim?: number = 1;

  @ApiProperty({ description: 'Fecha de activación (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  fechaActivacion?: string;

  @ApiProperty({ description: 'Fecha de vencimiento (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiProperty({ description: 'Notas', maxLength: 500, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}
```

**Nota:** `IdCliente` **no** se envía en el DTO; se obtiene de `req.user.idCliente` (JWT).

### update-sims.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateSimsDto } from './create-sims.dto';

export class UpdateSimsDto extends PartialType(CreateSimsDto) {}
```

### update-sims-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateSimsEstatusDto {
  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1 })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}
```

---

## 5. Paso 4: Service

**Archivo:** `src/sims/sims.service.ts`

Responsabilidades:

- **Multitenancy:** Todas las operaciones filtran por `idCliente` (del JWT).
- `create(dto, idCliente, idUser)`: validar ICC y IMEI único, validar FKs (IdTelefonia, IdPlanTelefonia, IdEstatusSim), crear con IdCliente del JWT, Bitácora.
- `findAllList(idCliente, soloActivos?)`: lista completa del tenant.
- `findAll(idCliente, page, limit, soloActivos?)`: paginado del tenant.
- `findOne(id, idCliente)`: por ID, validar que pertenezca al tenant.
- `update(id, dto, idCliente, idUser)`: validar pertenencia al tenant, ICC único si se modifica, validar FKs, Bitácora.
- `updateEstatus(id, dto, idCliente, idUser)`: cambiar Estatus, Bitácora.

**Validaciones:**

- ICC único a nivel global (no repetir en todo el sistema).
- IdTelefonia, IdPlanTelefonia, IdEstatusSim deben existir en sus catálogos.
- IdCliente se inyecta desde JWT, no desde el body.

**Bitácora:** `BitacoraLoggerService.logToBitacora('Sims', descripcion, accion, query, idUsuario, ID_MODULO_SIMS, estatus, error)`.

**IdModulo:** `ID_MODULO_SIMS = 14` (módulo Sims en tabla Modulos).

---

## 6. Paso 5: Controller

**Archivo:** `src/sims/sims.controller.ts`

Convenciones:

- `@ApiTags('Sims')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o permisos del módulo Sims)
- `@Controller('sims')`

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

**Archivo:** `src/sims/sims.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sims } from 'src/entities/Sims';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { SimsController } from './sims.controller';
import { SimsService } from './sims.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sims]),
    BitacoraModule,
  ],
  controllers: [SimsController],
  providers: [SimsService],
  exports: [SimsService],
})
export class SimsModule {}
```

**Nota:** No es necesario importar CatTelefonia, CatPlanesTelefonia, CatEstatusSim ni Clientes como módulos; TypeORM resuelve las FKs. Solo se usan para validar existencia en el Service (inyección de Repository si se requiere).

---

## 8. Paso 7: Registro en app.module.ts

```typescript
import { SimsModule } from './sims/sims.module';

// En imports:
SimsModule,
```

---

## 9. Resumen de convenciones

| Elemento | Valor |
|----------|-------|
| applySchema | Default: `Next` |
| ApiBearerAuth | `'bearer-token'` |
| Guards | JwtAuthGuard + RolesGuard + @Roles() |
| Multitenancy | IdCliente desde req.user.idCliente |
| ICC | Unique global (UQ_Sims_ICC) |
| Rutas estatus | PATCH /estatus/:id |
| DELETE | Soft delete vía PATCH estatus |
| Bitácora | En create, update, updateEstatus |
| IdModulo Bitácora | 14 (Sims) |
| Paginación | GET /list + GET /:page/:limit |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/sims/list?soloActivos=true`
- `GET /api/sims/:page/:limit`
- `GET /api/sims/:id`
- `POST /api/sims/`
- `PATCH /api/sims/:id`
- `PATCH /api/sims/estatus/:id`

---

## 11. Uso del módulo

Sims almacena tarjetas SIM de conectividad para dispositivos GPS. Cada SIM pertenece a un cliente (tenant), tiene un plan de datos (CatPlanesTelefonia) y una compañía (CatTelefonia). Los dispositivos GPS referencian Sims mediante IdSim cuando están instalados.

---

## 12. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Especificaciones API, convenciones
- `docs/CONTEXTO-PROYECTO.md` — Sección 4.3 (Dispositivos GPS e IoT), 7.2 (Relaciones)
- `docs/RESUMEN-BD-Next20260309.md` — Estado de tablas

*Documento de referencia para implementar el módulo Sims en NextAPI.*

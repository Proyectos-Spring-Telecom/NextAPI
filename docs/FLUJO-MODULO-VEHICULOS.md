# Flujo: Crear módulo Vehiculos

Este documento describe el flujo paso a paso para implementar el módulo **Vehiculos** (flota por cliente) en NextAPI. Es una **entidad operativa** (no catálogo), con multitenancy y FKs a catálogos. Sigue las convenciones de `CONTRATO-PROYECTO-NEXTAPI.md` y `CONTEXTO-PROYECTO.md`.

**Nota:** Vehiculos es parte del dominio **Flota** (CONTEXTO 4.3). La tabla ya existe en BD. Cadena operativa: CatTelefonia → CatPlanesTelefonia → Sims → Dispositivos → Instalaciones → **Vehiculos**.

**Estado actual:** La entidad `Vehiculos.ts` existe de forma mínima (creada para la FK compuesta de Instalaciones). Este flujo documenta la estructura completa de la tabla en BD y los pasos para implementar el módulo completo.

---

## 1. Entidad

### 1.1 Tabla en BD

```sql
CREATE TABLE `Vehiculos` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `IdCliente` bigint NOT NULL COMMENT 'FK → Clientes.Id (multitenancy)',
  `Placa` varchar(10) NOT NULL COMMENT 'Placas oficiales (S/P si no tiene)',
  `NumeroEconomico` varchar(50) NOT NULL COMMENT 'Número interno de flota',
  `IdModeloVehiculo` bigint NOT NULL COMMENT 'FK → CatModeloVehiculo.Id (contiene la marca)',
  `IdTipoVehiculo` bigint NOT NULL COMMENT 'FK → CatTipoVehiculo.Id',
  `Anio` int NOT NULL COMMENT 'Año modelo',
  `Color` varchar(30) DEFAULT NULL,
  `NumeroSerie` varchar(20) DEFAULT NULL COMMENT 'VIN / Número de serie del vehículo',
  `Foto` varchar(500) DEFAULT NULL COMMENT 'URL S3 imagen principal',
  `FotoFrente` varchar(500) DEFAULT NULL,
  `FotoTrasera` varchar(500) DEFAULT NULL,
  `FotoDerecha` varchar(500) DEFAULT NULL,
  `FotoIzquierda` varchar(500) DEFAULT NULL,
  `FotoExtra` varchar(500) DEFAULT NULL,
  `TarjetaCirculacion` varchar(500) DEFAULT NULL,
  `PolizaSeguro` varchar(500) DEFAULT NULL,
  `PermisoConcesion` varchar(500) DEFAULT NULL,
  `InspeccionMecanica` varchar(500) DEFAULT NULL,
  `PasajerosSentados` int unsigned DEFAULT NULL,
  `PasajerosParados` int unsigned DEFAULT NULL,
  `IdCombustible` bigint DEFAULT NULL COMMENT 'FK → CatTipoCombustible.Id',
  `KM` float DEFAULT NULL COMMENT 'KM por litro según manual',
  `CapacidadLitros` float DEFAULT NULL COMMENT 'Capacidad del tanque en litros',
  `IdEstatusVehiculo` bigint NOT NULL DEFAULT '1' COMMENT 'FK → CatEstatusVehiculo.Id',
  `CantidadAccesos` int DEFAULT NULL COMMENT 'Contador de usos/accesos del vehículo',
  `Estatus` tinyint NOT NULL DEFAULT '1' COMMENT '1=Activo 0=Inactivo (lógico)',
  `FechaCreacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaActualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_Vehiculos_IdCliente_Id` (`IdCliente`,`Id`),
  UNIQUE KEY `UQ_Vehiculos_Placa` (`Placa`,`IdCliente`),
  KEY `FK_Vehiculos_CatModeloVehiculo` (`IdModeloVehiculo`),
  KEY `FK_Vehiculos_CatTipoVehiculo` (`IdTipoVehiculo`),
  KEY `FK_Vehiculos_CatTipoCombustible` (`IdCombustible`),
  CONSTRAINT `FK_Vehiculos_CatModeloVehiculo` FOREIGN KEY (`IdModeloVehiculo`) REFERENCES `CatModeloVehiculo` (`Id`),
  CONSTRAINT `FK_Vehiculos_CatTipoCombustible` FOREIGN KEY (`IdCombustible`) REFERENCES `CatTipoCombustible` (`Id`),
  CONSTRAINT `FK_Vehiculos_CatTipoVehiculo` FOREIGN KEY (`IdTipoVehiculo`) REFERENCES `CatTipoVehiculo` (`Id`),
  CONSTRAINT `FK_Vehiculos_Clientes` FOREIGN KEY (`IdCliente`) REFERENCES `Clientes` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Características:**

- **Multitenancy:** `IdCliente` obligatorio; todas las operaciones filtran por tenant (JWT).
- **Unique:** `(Placa, IdCliente)` — placa única por cliente; `(IdCliente, Id)` — para FK compuesta de Instalaciones.
- **FKs obligatorios:** IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo, IdCliente.
- **FK opcional:** IdCombustible → CatTipoCombustible.
- **Campos de documentos/fotos:** URLs S3 (Foto, FotoFrente, FotoTrasera, TarjetaCirculacion, PolizaSeguro, etc.).
- **Timestamps:** FechaCreacion, FechaActualizacion (manejados por BD o TypeORM).
- **Soft delete:** Campo `Estatus` (1=Activo, 0=Inactivo).

### 1.2 Dependencias

| Entidad | Uso |
|---------|-----|
| Clientes | IdCliente (tenant) — desde JWT |
| CatModeloVehiculo | IdModeloVehiculo (contiene la marca) |
| CatTipoVehiculo | IdTipoVehiculo |
| CatEstatusVehiculo | IdEstatusVehiculo (default 1) |
| CatTipoCombustible | IdCombustible (opcional) |

---

## 2. Paso 1: Entidad Vehiculos

**Archivo:** `src/entities/Vehiculos.ts`

La entidad debe alinearse con la tabla en BD. **Diferencias con la entidad actual:**

| Campo BD | Entidad actual | Ajuste requerido |
|----------|----------------|------------------|
| `Placa` varchar(10) | `placa` length 20 | Cambiar a length 10 |
| `NumeroEconomico` | `economico` (nullable) | Renombrar a `numeroEconomico`, NOT NULL |
| `Anio` | — | Agregar |
| `Color`, `NumeroSerie` | — | Agregar (nullable) |
| `Foto`, `FotoFrente`, etc. | — | Agregar (nullable) |
| `TarjetaCirculacion`, `PolizaSeguro`, etc. | — | Agregar (nullable) |
| `PasajerosSentados`, `PasajerosParados` | — | Agregar (nullable) |
| `IdCombustible` | — | Agregar + ManyToOne CatTipoCombustible |
| `KM`, `CapacidadLitros` | — | Agregar (nullable) |
| `CantidadAccesos` | — | Agregar (nullable) |
| FK Clientes | — | Agregar si no existe |

**Nota:** El índice `UQ_Vehiculos_Placa` en BD es `(Placa, IdCliente)`; la entidad actual usa `(IdCliente, placa)`. Debe coincidir con la BD para evitar conflictos.

### 2.1 Código de la entidad (alineada a la tabla)

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
import { CatModeloVehiculo } from './CatModeloVehiculo';
import { CatTipoVehiculo } from './CatTipoVehiculo';
import { CatEstatusVehiculo } from './CatEstatusVehiculo';
import { CatTipoCombustible } from './CatTipoCombustible';

@applySchema
@Index('UQ_Vehiculos_IdCliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Vehiculos_Placa', ['placa', 'idCliente'], { unique: true })
@Index('IX_Vehiculos_IdCliente_IdEstatusVehiculo', [
  'idCliente',
  'idEstatusVehiculo',
])
@Index('IX_Vehiculos_Estatus', ['estatus'])
@Entity('Vehiculos')
export class Vehiculos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Placa', length: 10 })
  placa: string;

  @Column('varchar', { name: 'NumeroEconomico', length: 50 })
  numeroEconomico: string;

  @Column('bigint', { name: 'IdModeloVehiculo' })
  idModeloVehiculo: number;

  @Column('bigint', { name: 'IdTipoVehiculo' })
  idTipoVehiculo: number;

  @Column('int', { name: 'Anio' })
  anio: number;

  @Column('varchar', { name: 'Color', length: 30, nullable: true })
  color: string | null;

  @Column('varchar', { name: 'NumeroSerie', length: 20, nullable: true })
  numeroSerie: string | null;

  @Column('varchar', { name: 'Foto', length: 500, nullable: true })
  foto: string | null;

  @Column('varchar', { name: 'FotoFrente', length: 500, nullable: true })
  fotoFrente: string | null;

  @Column('varchar', { name: 'FotoTrasera', length: 500, nullable: true })
  fotoTrasera: string | null;

  @Column('varchar', { name: 'FotoDerecha', length: 500, nullable: true })
  fotoDerecha: string | null;

  @Column('varchar', { name: 'FotoIzquierda', length: 500, nullable: true })
  fotoIzquierda: string | null;

  @Column('varchar', { name: 'FotoExtra', length: 500, nullable: true })
  fotoExtra: string | null;

  @Column('varchar', { name: 'TarjetaCirculacion', length: 500, nullable: true })
  tarjetaCirculacion: string | null;

  @Column('varchar', { name: 'PolizaSeguro', length: 500, nullable: true })
  polizaSeguro: string | null;

  @Column('varchar', { name: 'PermisoConcesion', length: 500, nullable: true })
  permisoConcesion: string | null;

  @Column('varchar', { name: 'InspeccionMecanica', length: 500, nullable: true })
  inspeccionMecanica: string | null;

  @Column('int', { name: 'PasajerosSentados', unsigned: true, nullable: true })
  pasajerosSentados: number | null;

  @Column('int', { name: 'PasajerosParados', unsigned: true, nullable: true })
  pasajerosParados: number | null;

  @Column('bigint', { name: 'IdCombustible', nullable: true })
  idCombustible: number | null;

  @Column('float', { name: 'KM', nullable: true })
  km: number | null;

  @Column('float', { name: 'CapacidadLitros', nullable: true })
  capacidadLitros: number | null;

  @Column('bigint', { name: 'IdEstatusVehiculo', default: 1 })
  idEstatusVehiculo: number;

  @Column('int', { name: 'CantidadAccesos', nullable: true })
  cantidadAccesos: number | null;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatModeloVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdModeloVehiculo', referencedColumnName: 'id' }])
  idModeloVehiculo2: CatModeloVehiculo;

  @ManyToOne(() => CatTipoVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdTipoVehiculo', referencedColumnName: 'id' }])
  idTipoVehiculo2: CatTipoVehiculo;

  @ManyToOne(() => CatEstatusVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEstatusVehiculo', referencedColumnName: 'id' }])
  idEstatusVehiculo2: CatEstatusVehiculo;

  @ManyToOne(() => CatTipoCombustible, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCombustible', referencedColumnName: 'id' }])
  idCombustible2: CatTipoCombustible | null;
}
```

---

## 3. Paso 2: Estructura de carpetas y archivos

```
src/
├── entities/
│   └── Vehiculos.ts
└── vehiculos/
    ├── vehiculos.module.ts
    ├── vehiculos.controller.ts
    ├── vehiculos.service.ts
    └── dto/
        ├── create-vehiculos.dto.ts
        ├── update-vehiculos.dto.ts
        └── update-vehiculos-estatus.dto.ts
```

---

## 4. Paso 3: DTOs

### create-vehiculos.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehiculosDto {
  @ApiProperty({
    description: 'Placas oficiales (S/P si no tiene)',
    example: 'ABC1234',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  placa: string;

  @ApiProperty({
    description: 'Número interno de flota',
    example: 'VH-001',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroEconomico: string;

  @ApiProperty({ description: 'ID modelo (CatModeloVehiculo)' })
  @IsInt()
  @IsNotEmpty()
  idModeloVehiculo: number;

  @ApiProperty({ description: 'ID tipo (CatTipoVehiculo)' })
  @IsInt()
  @IsNotEmpty()
  idTipoVehiculo: number;

  @ApiProperty({ description: 'Año modelo', example: 2024 })
  @IsInt()
  @IsNotEmpty()
  @Min(1900)
  anio: number;

  @ApiProperty({ description: 'Color', maxLength: 30, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiProperty({ description: 'VIN / Número de serie', maxLength: 20, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroSerie?: string;

  @ApiProperty({ description: 'URL imagen principal S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  foto?: string;

  @ApiProperty({ description: 'URL TarjetaCirculacion', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tarjetaCirculacion?: string;

  @ApiProperty({ description: 'URL PolizaSeguro', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  polizaSeguro?: string;

  @ApiProperty({ description: 'URL PermisoConcesion', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  permisoConcesion?: string;

  @ApiProperty({ description: 'URL InspeccionMecanica', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspeccionMecanica?: string;

  @ApiProperty({ description: 'Pasajeros sentados', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  pasajerosSentados?: number;

  @ApiProperty({ description: 'Pasajeros parados', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  pasajerosParados?: number;

  @ApiProperty({ description: 'ID combustible (CatTipoCombustible)', required: false })
  @IsOptional()
  @IsInt()
  idCombustible?: number;

  @ApiProperty({ description: 'KM por litro', required: false })
  @IsOptional()
  @IsNumber()
  km?: number;

  @ApiProperty({ description: 'Capacidad tanque (litros)', required: false })
  @IsOptional()
  @IsNumber()
  capacidadLitros?: number;

  @ApiProperty({
    description: 'ID estatus (CatEstatusVehiculo)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  idEstatusVehiculo?: number = 1;

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

**Nota:** `IdCliente` se obtiene de `req.user.idCliente` (JWT). Campos opcionales de fotos adicionales (FotoFrente, FotoTrasera, etc.) pueden agregarse al DTO si se requieren en el create.

### update-vehiculos.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateVehiculosDto } from './create-vehiculos.dto';

export class UpdateVehiculosDto extends PartialType(CreateVehiculosDto) {}
```

### update-vehiculos-estatus.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateVehiculosEstatusDto {
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

**Archivo:** `src/vehiculos/vehiculos.service.ts`

Responsabilidades:

- **Multitenancy:** Todas las operaciones filtran por `idCliente` (del JWT).
- `create(dto, idCliente, idUser)`: validar Placa única por cliente, validar FKs (IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo, IdCombustible si se envía), crear, Bitácora.
- `findAllList(idCliente, soloActivos?)`: lista completa del tenant.
- `findAll(idCliente, page, limit, soloActivos?)`: paginado del tenant.
- `findOne(id, idCliente)`: por ID, validar pertenencia al tenant.
- `update(id, dto, idCliente, idUser)`: validar pertenencia, Placa única por cliente si cambia, validar FKs, Bitácora.
- `updateEstatus(id, dto, idCliente, idUser)`: cambiar Estatus, Bitácora.

**Validaciones:**

- **Placa única por cliente:** `(Placa, IdCliente)` — no puede haber dos vehículos con la misma placa en el mismo tenant.
- **FKs:** IdModeloVehiculo, IdTipoVehiculo, IdEstatusVehiculo deben existir. IdCombustible (si se envía) debe existir en CatTipoCombustible.
- IdCliente se inyecta desde JWT, no desde el body.

**Bitácora:** `BitacoraLoggerService.logToBitacora('Vehiculos', descripcion, accion, query, idUsuario, ID_MODULO_VEHICULOS, estatus, error)`.

**IdModulo:** `ID_MODULO_VEHICULOS = 16` (módulo Vehiculos en tabla Modulos).

**Campo `data.nombre` para ApiCrudResponse:** Usar `placa` o `numeroEconomico` como identificador descriptivo (ej.: `{ id, nombre: placa }`).

---

## 6. Paso 5: Controller

**Archivo:** `src/vehiculos/vehiculos.controller.ts`

Convenciones:

- `@ApiTags('Vehiculos')`
- `@ApiBearerAuth('bearer-token')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles()` (o permisos del módulo Vehiculos)
- `@Controller('vehiculos')`

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

**Archivo:** `src/vehiculos/vehiculos.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModeloVehiculo } from 'src/entities/CatModeloVehiculo';
import { CatTipoVehiculo } from 'src/entities/CatTipoVehiculo';
import { CatEstatusVehiculo } from 'src/entities/CatEstatusVehiculo';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehiculos,
      CatModeloVehiculo,
      CatTipoVehiculo,
      CatEstatusVehiculo,
      CatTipoCombustible,
    ]),
    BitacoraModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService],
  exports: [VehiculosService],
})
export class VehiculosModule {}
```

---

## 8. Paso 7: Registro en app.module.ts

```typescript
import { VehiculosModule } from './vehiculos/vehiculos.module';

// En imports:
VehiculosModule,
```

---

## 9. Resumen de convenciones

| Elemento | Valor |
|----------|-------|
| applySchema | Default: `Next` |
| ApiBearerAuth | `'bearer-token'` |
| Guards | JwtAuthGuard + RolesGuard + @Roles() |
| Multitenancy | IdCliente desde req.user.idCliente |
| Placa | Unique por tenant `(Placa, IdCliente)` |
| Rutas estatus | PATCH /estatus/:id |
| DELETE | Soft delete vía PATCH estatus |
| Bitácora | En create, update, updateEstatus |
| IdModulo Bitácora | 16 (Vehiculos) |
| Paginación | GET /list + GET /:page/:limit |

---

## 10. Rutas finales

Todas bajo prefijo `/api`:

- `GET /api/vehiculos/list?soloActivos=true`
- `GET /api/vehiculos/:page/:limit`
- `GET /api/vehiculos/:id`
- `POST /api/vehiculos/`
- `PATCH /api/vehiculos/:id`
- `PATCH /api/vehiculos/estatus/:id`

---

## 11. Alineación entidad actual vs. tabla BD

La entidad `Vehiculos.ts` existente fue creada de forma mínima para la FK compuesta de Instalaciones. Para implementar el módulo completo:

1. **Actualizar la entidad** según la sección 2.1 (cambiar `economico` → `numeroEconomico`, `placa` length 10, agregar todos los campos de la tabla).
2. **Crear** la carpeta `src/vehiculos/` con controller, service, module y DTOs.
3. **Registrar** `VehiculosModule` en `app.module.ts`.

Si se prefiere una implementación por fases, se puede empezar con la entidad actual (solo campos básicos) y los DTOs reducidos, añadiendo después los campos de documentos y fotos.

---

## 12. Uso del módulo

Vehiculos almacena la flota de cada cliente (placa, económico, marca/modelo, año, documentos, fotos, estado). Cada vehículo se vincula a un dispositivo GPS mediante el módulo Instalaciones. Los campos de fotos y documentos almacenan URLs de S3.

---

## 13. Referencias

- `docs/CONTRATO-PROYECTO-NEXTAPI.md` — Especificaciones API, convenciones
- `docs/CONTEXTO-PROYECTO.md` — Sección Flota, 7.2 (Relaciones)
- `docs/FLUJO-MODULO-INSTALACIONES.md` — Módulo Instalaciones (entidad relacionada, FK compuesta a Vehiculos)
- `docs/FLUJO-MODULO-DISPOSITIVOS.md` — Módulo Dispositivos (patrón operativo)
- `docs/ANALISIS-BD-NEXT.md` — Estado de tablas

*Documento de referencia para implementar el módulo Vehiculos en NextAPI.*

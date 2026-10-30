import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIPOS_SERVICIO } from '../ordenes-servicio.reglas';

/**
 * DTOs de la etapa 2 (docs/ordenes-servicio.md §12): programar, iniciar,
 * código, autorización, no cumplida y cancelación con motivo.
 */

export class ProgramarOrdenDto {
  @ApiProperty({ enum: TIPOS_SERVICIO, description: 'Tipo programado; el técnico lo confirma o corrige al iniciar' })
  @IsIn([...TIPOS_SERVICIO])
  tipo: (typeof TIPOS_SERVICIO)[number];

  @ApiProperty({ description: 'Cliente ya formalizado en Next (activo)' })
  @IsInt()
  idCliente: number;

  @ApiPropertyOptional({ description: 'Mantenimientos: instalación vigente (el vehículo). No va en `instalacion`.' })
  @IsOptional()
  @IsInt()
  idInstalacion?: number;

  @ApiPropertyOptional({ description: 'Solo `instalacion`: crea N órdenes independientes, una por vehículo', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  unidades?: number;

  @ApiProperty({ description: 'Inicio de la cita, ISO 8601 con zona', example: '2026-10-30T10:00:00-06:00' })
  @IsISO8601()
  cita: string;

  @ApiPropertyOptional({ description: 'Fin estimado de la cita, ISO 8601 con zona' })
  @IsOptional()
  @IsISO8601()
  citaFin?: string;

  @ApiProperty({ description: 'Técnico asignado: usuario activo con rol 8' })
  @IsInt()
  idTecnico: number;

  @ApiPropertyOptional({ description: 'Orden no cumplida o cancelada que ésta reprograma' })
  @IsOptional()
  @IsInt()
  idOrdenOrigen?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class ProgramarOrdenCrmDto extends ProgramarOrdenDto {
  @ApiProperty({ description: 'Referencia de la orden en el CRM; con la unidad hace idempotente la llamada', example: 'OI-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  referenciaCrm: string;

  @ApiPropertyOptional({ description: 'Usuario del CRM que programó (para el registro)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;
}

export class ReprogramarOrdenDto {
  @ApiPropertyOptional({ description: 'ISO 8601 con zona' })
  @IsOptional()
  @IsISO8601()
  cita?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 con zona; null la borra', nullable: true })
  @IsOptional()
  @IsISO8601()
  citaFin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  idTecnico?: number;

  @ApiPropertyOptional({ description: 'Mantenimientos: otro vehículo (instalación vigente del cliente)' })
  @IsOptional()
  @IsInt()
  idInstalacion?: number;

  @ApiPropertyOptional({ description: 'Usuario del CRM (solo integración)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;
}

export class IniciarOrdenDto {
  @ApiProperty({ description: 'UUID que genera la app; reenviar con la misma clave devuelve la orden', example: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90' })
  @IsUUID()
  claveApp: string;

  @ApiPropertyOptional({
    enum: TIPOS_SERVICIO,
    description: 'Tipo real si difiere del programado (solo entre mantenimientos)',
  })
  @IsOptional()
  @IsIn([...TIPOS_SERVICIO])
  tipoServicio?: (typeof TIPOS_SERVICIO)[number];

  @ApiPropertyOptional({ description: 'Mantenimientos: vehículo elegido en campo (por defecto, el programado)' })
  @IsOptional()
  @IsInt()
  idInstalacion?: number;

  @ApiPropertyOptional({ description: 'Alta: vehículo ya dado de alta' })
  @IsOptional()
  @IsInt()
  idProducto?: number;
}

export class MotivoOrdenDto {
  @ApiProperty({ description: 'Clave de GET /ordenes-servicio/motivos', example: 'cliente_ausente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  claveMotivo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Solo operación o CRM: cambia el valor por defecto del motivo' })
  @IsOptional()
  @IsBoolean()
  cobrable?: boolean;

  @ApiPropertyOptional({ description: 'Usuario del CRM (solo integración)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;
}

/** Cancelar: el motivo es obligatorio salvo en las órdenes de la etapa 1. */
export class CancelarOrdenDto {
  @ApiPropertyOptional({ description: 'Obligatorio en órdenes programadas' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  claveMotivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Usuario del CRM (solo integración)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;
}

export class ValidarCodigoDto {
  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  codigo: string;
}

export class SolicitarAutorizacionDto {
  @ApiPropertyOptional({ description: 'Qué equipo se encontró. La foto va en archivos con la clave `equipo_existente`.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class DecisionAutorizacionDto {
  @ApiProperty({ description: 'true = se desinstala el equipo existente y sigue el alta; false = la orden queda no cumplida' })
  @IsBoolean()
  autorizada: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Usuario del CRM (solo integración)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;
}

export class CambiosOrdenesDto {
  @ApiPropertyOptional({ description: 'Devuelve las órdenes modificadas desde aquí (inclusive). Usar el `hasta` de la respuesta anterior.' })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({ default: 200, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}

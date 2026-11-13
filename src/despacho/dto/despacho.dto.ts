import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export class ParadaRutaDto {
  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPuntoInteres!: number;

  @ApiPropertyOptional({
    description: 'Inicio de la ventana de llegada (HH:mm)',
    example: '08:00',
  })
  @IsOptional()
  @Matches(HORA_RE, { message: 'horaDesde debe ser HH:mm' })
  horaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fin de la ventana de llegada (HH:mm)',
    example: '09:00',
  })
  @IsOptional()
  @Matches(HORA_RE, { message: 'horaHasta debe ser HH:mm' })
  horaHasta?: string;
}

export class CrearRutaDto {
  @ApiProperty({ example: 47 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({ example: 'Reparto zona norte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Lunes a viernes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ type: [ParadaRutaDto], description: 'En orden de visita (1 a 50)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParadaRutaDto)
  paradas!: ParadaRutaDto[];
}

export class ActualizarRutaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    enum: [0, 1],
    description: '0 inactiva (no se usa en trabajos nuevos), 1 activa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  estatus?: number;

  @ApiPropertyOptional({
    type: [ParadaRutaDto],
    description: 'Reemplaza todas las paradas (no cambia los trabajos ya creados)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParadaRutaDto)
  paradas?: ParadaRutaDto[];
}

export class ParadaTrabajoDto {
  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPuntoInteres!: number;

  @ApiPropertyOptional({ example: '2026-11-14 08:00:00' })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'ventanaDesde debe ser YYYY-MM-DD HH:mm:ss' })
  ventanaDesde?: string;

  @ApiPropertyOptional({ example: '2026-11-14 09:00:00' })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'ventanaHasta debe ser YYYY-MM-DD HH:mm:ss' })
  ventanaHasta?: string;
}

export class CrearTrabajoDto {
  @ApiProperty({ example: 1000325 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion!: number;

  @ApiPropertyOptional({
    description:
      'Ruta plantilla: copia sus paradas con la fecha del trabajo. Sin ella, `paradas`.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idRuta?: number;

  @ApiPropertyOptional({
    type: [ParadaTrabajoDto],
    description: 'Paradas sueltas, en orden (si no hay idRuta)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParadaTrabajoDto)
  paradas?: ParadaTrabajoDto[];

  @ApiProperty({ example: 'Entrega pedido 1842' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;

  @ApiProperty({ example: '2026-11-14' })
  @Matches(DIA_RE, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha!: string;

  @ApiPropertyOptional({
    description: 'Desde cuándo cuentan las llegadas (por defecto 00:00 de la fecha)',
    example: '2026-11-14 07:00:00',
  })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'inicio debe ser YYYY-MM-DD HH:mm:ss' })
  inicio?: string;

  @ApiPropertyOptional({
    description: 'Hasta cuándo cuentan (por defecto 23:59:59 de la fecha)',
    example: '2026-11-14 18:00:00',
  })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'fin debe ser YYYY-MM-DD HH:mm:ss' })
  fin?: string;
}

export class ActualizarTrabajoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;

  @ApiPropertyOptional({ example: '2026-11-14 07:00:00' })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'inicio debe ser YYYY-MM-DD HH:mm:ss' })
  inicio?: string;

  @ApiPropertyOptional({ example: '2026-11-14 18:00:00' })
  @IsOptional()
  @Matches(FECHA_HORA_RE, { message: 'fin debe ser YYYY-MM-DD HH:mm:ss' })
  fin?: string;
}

export class CancelarTrabajoDto {
  @ApiProperty({ example: 'El cliente reprogramó la entrega' })
  @IsString()
  @Length(5, 300)
  motivo!: string;
}

export class ListarTrabajosDto {
  @ApiProperty({ example: '2026-11-14' })
  @Matches(DIA_RE, { message: 'fechaInicio debe ser YYYY-MM-DD' })
  fechaInicio!: string;

  @ApiPropertyOptional({ example: '2026-11-14' })
  @IsOptional()
  @Matches(DIA_RE, { message: 'fechaFinal debe ser YYYY-MM-DD' })
  fechaFinal?: string;

  @ApiPropertyOptional({ example: 47 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({ example: 1000325 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion?: number;
}

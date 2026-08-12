import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCatPlanesTelefoniaDto {
  @ApiPropertyOptional({
    description: 'Descripción del plan',
    example: 'Plan empresarial 10 GB',
    maxLength: 500,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({
    description: 'ID del operador de telefonía (CatTelefonia)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  idTelefonia!: number;

  @ApiPropertyOptional({
    description: 'Datos incluidos (NULL = ilimitado)',
    example: '10240',
    maxLength: 100,
    nullable: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  datos?: string | null;

  @ApiPropertyOptional({
    description: 'SMS incluidos',
    example: '1000',
    maxLength: 100,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  smsIncluidos?: string;

  @ApiPropertyOptional({
    description: 'Minutos de voz incluidos',
    example: '1000',
    maxLength: 100,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vozIncluidos?: string;

  @ApiPropertyOptional({
    description: 'Costo mensual en MXN',
    example: '499.90',
    maxLength: 100,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  costoMensual?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio de vigencia (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  fechaInicioVigencia?: string;

  @ApiPropertyOptional({
    description: 'Fecha fin de vigencia (null = sin fecha fin)',
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  fechaFinVigencia?: string | null;
}

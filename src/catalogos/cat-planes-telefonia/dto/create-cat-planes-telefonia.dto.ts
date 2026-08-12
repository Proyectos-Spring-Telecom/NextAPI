import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
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
  Descripcion?: string;

  @ApiProperty({
    description: 'ID del operador de telefonía (CatTelefonia)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  IdTelefonia: number;

  @ApiPropertyOptional({
    description: 'Datos incluidos en MB (null = ilimitado)',
    example: 10240,
    nullable: true,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  DatosMB?: number | null;

  @ApiPropertyOptional({
    description: 'SMS incluidos',
    example: 1000,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  SMSIncluidos?: number;

  @ApiPropertyOptional({
    description: 'Minutos de voz incluidos',
    example: 1000,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  VozIncluidos?: number;

  @ApiPropertyOptional({
    description: 'Costo mensual en MXN, máximo dos decimales',
    example: 499.9,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  CostoMensual?: number;

  @ApiPropertyOptional({
    description: 'Fecha de inicio de vigencia (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  FechaInicioVigencia?: string;

  @ApiPropertyOptional({
    description: 'Fecha fin de vigencia (null = sin fecha fin)',
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  FechaFinVigencia?: string | null;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FilterCatPlanesTelefoniaDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  IdTelefonia?: number;

  @ApiPropertyOptional({ description: 'Coincidencia parcial' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  Descripcion?: string;

  @ApiPropertyOptional({ enum: [0, 1] })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  Estatus?: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  FechaInicioVigencia?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  FechaFinVigencia?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  CostoMensualMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  CostoMensualMax?: number;

  @ApiPropertyOptional({
    description: 'Solo planes activos vigentes a la fecha actual',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  vigentes?: boolean;
}

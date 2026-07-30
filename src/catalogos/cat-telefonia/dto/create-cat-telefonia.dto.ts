import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCatTelefoniaDto {
  @ApiProperty({
    description: 'Nombre del operador de telefonía',
    example: 'Telcel',
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  NombreTelefonia: string;

  @ApiPropertyOptional({
    description: 'Nombre del asesor de la compañía',
    example: 'Juan Pérez',
    maxLength: 200,
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
  @MaxLength(200)
  NombreAsesor?: string;

  @ApiPropertyOptional({
    description: 'Número telefónico del asesor',
    example: '7771234567',
    maxLength: 20,
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
  @MaxLength(20)
  NumeroAsesor?: string;

  @ApiPropertyOptional({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  Estatus?: number;
}

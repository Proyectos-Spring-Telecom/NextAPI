import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Ítem de contacto de emergencia al crear un cliente. */
export class NumeroEmergenciaClienteItemDto {
  @ApiPropertyOptional({
    description: 'Nombre del contacto',
    example: 'Central de monitoreo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @ApiProperty({
    description: 'Teléfono de emergencia',
    example: '5512345678',
    maxLength: 14,
  })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono de emergencia es obligatorio' })
  @MaxLength(14)
  telefono!: string;

  @ApiPropertyOptional({
    description: 'Descripción',
    example: 'Línea 24/7',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Prioridad (menor = mayor prioridad)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prioridad?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNumeroEmergenciaDto {
  @ApiPropertyOptional({
    description:
      'ID del cliente. Obligatorio para roles globales/admin. ' +
      'Roles Cliente (6) y Usuario (9): se ignora y se usa el `idCliente` del token.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

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
  @IsNotEmpty()
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
    description: 'Prioridad de contacto (menor = mayor prioridad)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prioridad?: number;
}

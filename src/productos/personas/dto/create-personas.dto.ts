import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePersonasDto {
  @ApiProperty({
    description: 'ID del cliente/tenant propietario. Obligatorio.',
    example: 11,
  })
  @IsInt()
  @IsNotEmpty()
  idCliente!: number;

  @ApiProperty({
    description: 'Nombre de la persona',
    example: 'Juan Pérez',
    maxLength: 250,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '5512345678',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;
}

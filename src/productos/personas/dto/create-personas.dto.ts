import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  transformOptionalNumber,
  transformOptionalString,
} from 'src/common/transforms/form-data.transforms';
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
  @Transform(transformOptionalNumber)
  @IsInt()
  @IsNotEmpty()
  idCliente!: number;

  @ApiProperty({
    description: 'Nombre de la persona',
    example: 'Juan Pérez',
    maxLength: 250,
  })
  @Transform(transformOptionalString)
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
  @Transform(transformOptionalString)
  @IsString()
  @MaxLength(20)
  telefono?: string;
}

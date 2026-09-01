import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  transformOptionalNumber,
  transformOptionalNumberArray,
  transformOptionalString,
} from 'src/common/transforms/form-data.transforms';

export class UpdateUsuarioDto {
  @IsOptional()
  @Transform(transformOptionalString)
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description:
      'Nombre del usuario. Omitir o enviar vacío para no modificar.',
    example: 'Juan',
    required: false,
  })
  nombre?: string;

  @IsOptional()
  @Transform(transformOptionalString)
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description:
      'Apellido paterno. Omitir o enviar vacío para no modificar.',
    example: 'Pérez',
    required: false,
  })
  apellidoPaterno?: string;

  @IsOptional()
  @Transform(transformOptionalString)
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description:
      'Apellido materno. Omitir o enviar vacío para no modificar.',
    example: 'López',
    required: false,
  })
  apellidoMaterno?: string;

  @IsOptional()
  @Transform(transformOptionalString)
  @IsString()
  @MaxLength(14)
  @ApiProperty({
    description: 'Teléfono. Omitir o enviar vacío para no modificar.',
    example: '5512345678',
    required: false,
  })
  telefono?: string;

  @IsOptional()
  @Transform(transformOptionalString)
  @IsString()
  @ApiProperty({
    description:
      'URL de foto de perfil. Omitir o enviar vacío para no modificar (use archivo para reemplazar).',
    required: false,
  })
  fotoPerfil?: string;

  @IsOptional()
  @Transform(transformOptionalNumber)
  @IsInt()
  @ApiProperty({
    description: 'Rol asignado. Omitir o enviar vacío para no modificar.',
    example: 2,
  })
  idRol?: number;

  @IsOptional()
  @Transform(transformOptionalNumber)
  @IsInt()
  @ApiProperty({
    description: 'Cliente asignado. Omitir o enviar vacío para no modificar.',
    example: 5,
  })
  idCliente?: number;

  @IsOptional()
  @Transform(transformOptionalNumberArray)
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      'Lista definitiva de permisos activos. Omitir o vacío = no modificar. Enviar [] para desactivar todos.',
    example: [3, 7, 15],
  })
  permisosIds?: number[];

  @IsOptional()
  @Transform(transformOptionalNumberArray)
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      'Lista definitiva de soluciones activas. Omitir o vacío = no modificar. Enviar [] para desactivar todas.',
    example: [1, 3],
  })
  solucionesIds?: number[];
}

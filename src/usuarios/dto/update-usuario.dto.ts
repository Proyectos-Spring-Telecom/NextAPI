
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    required: false,
  })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Apellido paterno',
    example: 'Pérez',
    required: true,
  })
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Apellido materno',
    example: 'López',
    required: false,
  })
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  @ApiProperty({
    description: 'Teléfono',
    example: '5512345678',
    required: false,
  })
  telefono?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Foto de perfil', required: false })
  fotoPerfil?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({ description: 'Rol asignado', example: 2 })
  idRol?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ description: 'Cliente asignado', example: 5 })
  idCliente?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: 'Lista definitiva de permisos activos del usuario',
    example: [3, 7, 15],
  })
  permisosIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: 'Lista definitiva de instalaciones activas del usuario',
    example: [1, 4],
  })
  instalacionesIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: 'Lista definitiva de paneles de alarma activos del usuario',
    example: [2, 5],
  })
  panelesAlarmaIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: 'Lista definitiva de soluciones activas del usuario',
    example: [1, 3],
  })
  solucionesIds?: number[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MaxLength,
  MinLength,
  IsArray,
  IsNumber,
  Matches,
} from 'class-validator';
import { transformNumberArray } from 'src/common/transforms/form-data.transforms';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nombre de usuario único (correo o identificador de acceso)',
    example: 'operador@empresa.com',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'El UserName es obligatorio' })
  @MaxLength(100, {
    message: 'El UserName no puede exceder los 100 caracteres',
  })
  userName: string;

  @ApiProperty({
    description:
      'Contraseña en texto plano. Debe tener al menos 6 caracteres, una letra, un número y un símbolo (@$!%*?&.)',
    example: 'P@ssword123',
    minLength: 6,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'El Password es obligatorio' })
  @MinLength(6, { message: 'El Password debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*\p{L})(?=.*\d)(?=.*[@$!%*?&.])[^\s]+$/u, {
    message:
      'El Password debe contener al menos una letra (UTF-8), un número y un símbolo común (@$!%*?&.)',
  })
  passwordHash: string;

  @ApiProperty({
    description: 'Nombre(s) del usuario',
    example: 'María',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Apellido paterno del usuario',
    example: 'García',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  apellidoPaterno: string;

  @ApiPropertyOptional({
    description: 'Apellido materno del usuario',
    example: 'López',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidoMaterno?: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto (máximo 14 caracteres)',
    example: '5512345678',
    maxLength: 14,
  })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  telefono?: string;

  @ApiPropertyOptional({
    description: 'URL o ruta de la foto de perfil',
    example: 'https://cdn.ejemplo.com/perfiles/usuario01.jpg',
  })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;

  @ApiProperty({
    description: 'ID del rol asignado al usuario',
    example: 3,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  idRol: number;

  @ApiProperty({
    description: 'ID del cliente al que pertenece el usuario',
    example: 6,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  idCliente: number;

  @ApiProperty({
    description:
      'IDs de permisos a asignar en UsuariosPermisos. Puede enviarse vacío [].',
    example: [3, 7, 15],
    type: Number,
    isArray: true,
  })
  @Transform(transformNumberArray)
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  permisosIds: number[];

  @ApiPropertyOptional({
    description:
      'IDs de instalaciones a asignar en UsuariosInstalaciones. Si se omite, no se crean relaciones.',
    example: [1, 4, 6],
    type: Number,
    isArray: true,
    default: [],
  })
  @Transform(transformNumberArray)
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  instalacionesIds?: number[];

  @ApiPropertyOptional({
    description:
      'IDs de paneles de alarma a asignar en UsuarioPanelAlarma. Si se omite, no se crean relaciones.',
    example: [2, 5],
    type: Number,
    isArray: true,
    default: [],
  })
  @Transform(transformNumberArray)
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  panelesAlarmaIds?: number[];

  @ApiPropertyOptional({
    description:
      'IDs de soluciones a asignar en AsignacionSoluciones. Si se omite, no se crean relaciones.',
    example: [1, 4],
    type: Number,
    isArray: true,
    default: [],
  })
  @Transform(transformNumberArray)
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  solucionesIds?: number[];
}

/** Ejemplo con todos los atributos públicos del DTO para Swagger (Try it out). */
export const CREATE_USUARIO_SWAGGER_EXAMPLE = {
  userName: 'operador@empresa.com',
  passwordHash: 'P@ssword123',
  nombre: 'María',
  apellidoPaterno: 'García',
  apellidoMaterno: 'López',
  telefono: '5512345678',
  fotoPerfil: 'https://cdn.ejemplo.com/perfiles/usuario01.jpg',
  idRol: 3,
  idCliente: 6,
  permisosIds: [3, 7, 15],
  instalacionesIds: [1, 4, 6],
  panelesAlarmaIds: [2, 5],
  solucionesIds: [1, 4],
} as const;

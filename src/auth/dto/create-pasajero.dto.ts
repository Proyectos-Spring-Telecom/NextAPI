import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EnumSolicitudPasajero } from 'src/common/estatus.enum';

export class CreateAltaPasajaroDto {
  @IsNotEmpty({
    message: 'El nombre no puede exceder los 100 caracteres',
  })
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    required: false,
  })
  nombre: string;

  @IsNotEmpty({
    message: 'El apellido paterno es necesarios.',
  })
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Apellido paterno',
    example: 'Pérez',
    required: true,
  })
  apellidoPaterno: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'Apellido materno',
    example: 'López',
    required: false,
  })
  apellidoMaterno?: string;

  @ApiProperty({
    example: '1995-08-15',
    description: 'Fecha de nacimiento (YYYY-MM-DD)',
  })
  @IsDateString()
  fechaNacimiento: string;

  @IsString()
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail()
  @MaxLength(100, {
    message: 'El UserName no puede exceder los 100 caracteres',
  })
  @ApiProperty({ description: 'Nombre de usuario', example: 'usuario01' })
  correo: string;

  @IsString()
  @IsNotEmpty({ message: 'El Password es obligatorio' })
  @MinLength(6, { message: 'El Password debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*\p{L})(?=.*\d)(?=.*[@$!%*?&.])[^\s]+$/u, {
    message:
      'El Password debe contener al menos una letra (UTF-8), un número y un símbolo común (@$!%*?&.)',
  })
  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'P@ssword123',
  })
  passwordHash: string;

  @IsEnum(EnumSolicitudPasajero, {
    message: 'Estado de solicitud: 0 (No Solicitado), 1 (SOLICITADO)',
  })
  @ApiProperty({
    description: 'Solicitud cambio tipo de pasajero',
    example: '0 = No Solicitado, 1 = Solicitado',
  })
  @IsNotEmpty()
  estadoSolicitud: EnumSolicitudPasajero = EnumSolicitudPasajero.NOSOLICITADO;

  @ApiProperty({
    description: 'url del documento',
    example: 'https.documento.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentacion?: string;

  @ApiProperty({
    example: 'MON-0001',
    description: 'Número de serie único del monedero',
  })
  @IsString()
  numeroSerieMonedero: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  @ApiProperty({
    description: 'Teléfono',
    example: '5512345678',
    required: false,
  })
  telefono?: string;

  @ApiProperty({
    description: 'CURP del pasajero',
    example: 'ABCDEFGHIJKLMNOPQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  @MinLength(18)
  curp?: string;
}

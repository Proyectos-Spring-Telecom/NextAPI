import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateOperadoresDto {
  @ApiProperty({
    description:
      'ID del usuario (Usuarios.Id) vinculado al operador; debe pertenecer al mismo IdCliente',
  })
  @IsInt()
  @IsNotEmpty()
  idUsuario: number;

  @ApiProperty({
    description: 'Fecha de nacimiento (YYYY-MM-DD)',
    example: '1990-05-15',
  })
  @IsString()
  @IsNotEmpty()
  fechaNacimiento: string;

  @ApiProperty({
    description: 'CURP (18 caracteres)',
    example: 'GARM900515HDFLRN09',
    minLength: 18,
    maxLength: 18,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(18)
  @MaxLength(18)
  curp: string;

  @ApiProperty({
    description: 'NSS (11 dígitos)',
    example: '12345678901',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(11)
  @MaxLength(11)
  @Matches(/^\d+$/, { message: 'NSS debe contener solo dígitos' })
  nss: string;

  @ApiProperty({
    description: 'Nombre del contacto de emergencia',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contactoEmergenciaNombre: string;

  @ApiProperty({
    description: 'Teléfono del contacto de emergencia',
    maxLength: 14,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  contactoEmergenciaTelefono: string;

  @ApiProperty({
    description: 'Ruta o URL de documento de identificación (INE/Pasaporte)',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  identificacion: string;

  @ApiProperty({
    description: 'Ruta o URL de fotografía del operador',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  foto?: string;

  @ApiProperty({
    description: 'Ruta o URL de comprobante de domicilio',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comprobanteDomicilio?: string;

  @ApiProperty({
    description: 'Ruta o URL de certificado médico',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  certificadoMedico?: string;

  @ApiProperty({
    description: 'Ruta o URL de antecedentes no penales',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  antecedentesNoPenales?: string;

  @ApiProperty({
    description: 'ID estatus operador (CatEstatusOperador)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  idEstatusOperador?: number = 1;

  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;

  // Campos adicionales para la primera licencia (obligatorios en create)
  @ApiProperty({
    description: 'Número oficial de la licencia (único global)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroLicencia: string;

  @ApiProperty({
    description: 'ID tipo licencia (CatTipoLicencia en BD)',
  })
  @IsInt()
  @IsNotEmpty()
  idTipoLicencia: number;

  @ApiProperty({
    description: 'ID categoría licencia (CatCategoriaLicencia en BD)',
  })
  @IsInt()
  @IsNotEmpty()
  idCategoriaLicencia: number;

  @ApiProperty({
    description: 'Fecha expedición licencia (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  fechaExpedicion: string;

  @ApiProperty({
    description: 'Fecha vencimiento licencia (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  fechaVencimiento: string;

  @ApiProperty({
    description: 'URL S3 del documento de la licencia',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  licencia: string;
}

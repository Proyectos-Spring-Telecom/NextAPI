import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateUsuarioContrasena {
  @IsString()
  @IsNotEmpty({ message: 'El Password es obligatorio' })
  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'P@ssword123',
  })
  passwordActual: string;

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
  passwordNueva: string;

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
  passwordNuevaConfirmacion: string;

}

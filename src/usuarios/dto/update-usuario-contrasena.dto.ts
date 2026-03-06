import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  Validate,
} from 'class-validator';
import { MatchPasswordConstraint } from 'src/common/validators/match-password.constraint';

export class UpdateUsuarioContrasena {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @ApiProperty({
    description: 'Contraseña actual',
    example: 'P@ssword123',
  })
  passwordActual: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*\p{L})(?=.*\d)(?=.*[@$!%*?&.])[^\s]+$/u, {
    message:
      'La contraseña debe contener al menos una letra, un número y un símbolo (@$!%*?&.)',
  })
  @ApiProperty({
    description: 'Nueva contraseña',
    example: 'P@ssword123',
  })
  passwordNueva: string;

  @IsString()
  @IsNotEmpty({ message: 'La confirmación de contraseña es obligatoria' })
  @Validate(MatchPasswordConstraint, ['passwordNueva'])
  @ApiProperty({
    description: 'Confirmación de la nueva contraseña',
    example: 'P@ssword123',
  })
  passwordNuevaConfirmacion: string;
}

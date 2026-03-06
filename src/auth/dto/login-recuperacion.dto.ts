import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  Validate,
} from 'class-validator';
import { MatchPasswordConstraint } from 'src/common/validators/match-password.constraint';

export class LoginAuthResetDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^\s]+$/u, {
    message:
      'La contraseña debe contener al menos una minúscula, una mayúscula y un número, sin espacios',
  })
  @ApiProperty({
    description: 'Nueva contraseña',
    example: 'NuevaPass123',
    minLength: 6,
  })
  passwordNueva: string;

  @IsString()
  @IsNotEmpty()
  @Validate(MatchPasswordConstraint, ['passwordNueva'])
  @ApiProperty({
    description: 'Confirmación de la nueva contraseña',
    example: 'NuevaPass123',
  })
  passwordConfirmacion: string;
}

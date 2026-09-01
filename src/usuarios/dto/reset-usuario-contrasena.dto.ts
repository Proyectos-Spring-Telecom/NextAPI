import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { MatchPasswordConstraint } from 'src/common/validators/match-password.constraint';

export class ResetUsuarioContrasenaDto {
  @IsOptional()
  @IsInt({ message: 'idUsuario debe ser un número entero' })
  @Min(1, { message: 'idUsuario debe ser mayor a 0' })
  @ApiPropertyOptional({
    description:
      'ID del usuario cuya contraseña se cambia. Obligatorio si el rol del token es SA, Admin o Jefe de Monitoreo; ignorado en otros roles.',
    example: 42,
  })
  idUsuario?: number;

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

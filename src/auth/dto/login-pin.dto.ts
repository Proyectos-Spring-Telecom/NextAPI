import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// 🔹 Validador personalizado para PIN
@ValidatorConstraint({ name: 'PinValidator', async: false })
export class PinValidator implements ValidatorConstraintInterface {
  validate(pin: string) {
    // Solo 6 u 8 dígitos numéricos
    if (!/^(\d{6}|\d{8})$/.test(pin)) return false;

    // No debe ser todos los dígitos iguales (ej. 111111 o 77777777)
    if (/^(\d)\1+$/.test(pin)) return false;

    // No debe ser consecutivo ascendente ni descendente
    const consecutivoAsc = '0123456789';
    const consecutivoDesc = '9876543210';

    if (consecutivoAsc.includes(pin)) return false;
    if (consecutivoDesc.includes(pin)) return false;

    return true;
  }

  defaultMessage() {
    return 'El PIN debe tener exactamente 6 u 8 dígitos, no puede ser consecutivo ni todos iguales';
  }
}

export class LoginAuthPinDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Usuario',
    example: 'ejemplo@ejemplo.com',
  })
  userName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{6}|\d{8})$/, {
    message: 'El PIN debe tener exactamente 6 u 8 dígitos numéricos',
  })
  @Validate(PinValidator)
  @ApiProperty({
    description: 'PIN numérico de 6 u 8 dígitos',
    examples: ['482915', '93746281'],
  })
  pinHash: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Identificador del dispositivo',
    example: '15aBW',
  })
  deviceId: string;
}

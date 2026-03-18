import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CodigoPasajeroAutenticacion {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Usuario (correo o identificador)',
    example: 'usuario@ejemplo.com',
  })
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  @ApiProperty({
    description: 'Código de verificación de 6 dígitos',
    example: '123456',
  })
  codigo: string;
}
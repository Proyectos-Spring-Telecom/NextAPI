import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CodigoPasajeroAutenticacion {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Código de verificación',
    example: '1234',
  })
  codigo: string;
}
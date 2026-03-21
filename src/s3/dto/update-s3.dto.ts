import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UploadDto {
  @IsNotEmpty()
  @IsIn(['clientes', 'operadores', 'usuarios', 'vehiculos', 'pasajeros'], {
    message:
      'El folder debe ser uno de: clientes, operadores, usuarios, vehiculos, pasajeros',
  })
  @ApiProperty({
    description:
      'Carpeta lógica dentro del bucket (prefijo de la key). Valores permitidos: clientes, operadores, usuarios, vehiculos, pasajeros.',
    enum: [
      'clientes',
      'operadores',
      'usuarios',
      'vehiculos',
      'pasajeros',
    ],
    example: 'clientes',
  })
  folder: string;

  @IsNotEmpty()
  @IsString({ message: 'idModule debe ser un número' })
  @ApiProperty({
    description:
      'ID numérico del módulo de negocio para bitácora (quién hizo la acción y desde qué módulo). Ejemplos: 1 Clientes, 2 Usuarios, 9 Operadores, 10 Vehículos. Enviar como string en form-data.',
    example: '1',
  })
  idModule: string;
}

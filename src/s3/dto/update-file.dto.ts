import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateFileDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'URL completa del archivo actual en S3 (la que guardaste en BD). Si se envía, tras subir el archivo nuevo se intenta eliminar este objeto en segundo plano. Si falla el borrado, la subida igual fue exitosa; revisa bitácora.',
    example:
      'https://mi-bucket.s3.us-east-1.amazonaws.com/vehiculos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png',
  })
  oldUrl?: string;

  @IsNotEmpty()
  @IsIn(['clientes', 'operadores', 'usuarios', 'vehiculos', 'pasajeros'], {
    message:
      'El folder debe ser uno de: clientes, operadores, usuarios, vehiculos, pasajeros',
  })
  @ApiProperty({
    description:
      'Carpeta lógica en el bucket. Debe coincidir con la convención usada al crear el recurso.',
    enum: [
      'clientes',
      'operadores',
      'usuarios',
      'vehiculos',
      'pasajeros',
    ],
    example: 'vehiculos',
  })
  folder: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description:
      'ID numérico del módulo para bitácora. Ejemplos: 1 Clientes, 10 Vehículos. Enviar como string en form-data.',
    example: '10',
  })
  idModule: string;
}

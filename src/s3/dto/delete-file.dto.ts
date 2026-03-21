import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteFileDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description:
      'URL completa del objeto en S3 (misma que devolvió POST /upload o PATCH /update y guardaste en base de datos). Se extrae la key del path de la URL para DeleteObject.',
    example:
      'https://mi-bucket.s3.us-east-1.amazonaws.com/vehiculos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png',
  })
  fileUrl: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description:
      'ID numérico del módulo para bitácora. Ejemplos: 1 Clientes, 10 Vehículos. Enviar como string.',
    example: '10',
  })
  idModule: string;
}

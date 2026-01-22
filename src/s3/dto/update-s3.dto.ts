import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty,IsString } from 'class-validator';

export class UploadDto {
  @IsNotEmpty()
  @IsIn(['clientes', 'operadores', 'usuarios','vehiculos','pasajeros'], {
    message: 'El folder debe ser uno de: clientes, operadores, usuarios, pasajeros',
  })
  @ApiProperty({
      description: 'Folder de bucket',
      example: 'clientes|operadores|usuarios|vehiculos',
      required: true,
    })
  folder: string;

  @IsNotEmpty()
  @IsString({ message: 'idModule debe ser un número' })
  @ApiProperty({
    description: 'id del modulo',
    example: '1',
    required: true,
  })
  idModule: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreatePanelAlarmaDto {
  @ApiProperty({ description: 'ID del dispositivo asociado al panel' })
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  idDispositivo: number;

  @ApiProperty({ description: 'Cuenta SIA del panel AX PRO', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cuentaSia: string;

  @ApiProperty({ description: 'Nombre descriptivo del panel', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ description: 'IP del panel', maxLength: 45, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @ApiProperty({
    description: '0=sin cifrado, 1=AES',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  cifradoActivo?: number = 0;

  @ApiProperty({ description: 'Clave AES (si cifradoActivo=1)', required: false })
  @ValidateIf((o) => o.cifradoActivo === 1)
  @IsString()
  @MaxLength(255)
  aesKey?: string;

  @ApiProperty({ description: 'Bits AES: 128, 192 o 256', example: 128, required: false })
  @IsOptional()
  @IsInt()
  @IsIn([128, 192, 256])
  aesBits?: number = 128;

  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}

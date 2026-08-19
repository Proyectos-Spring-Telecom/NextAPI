import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateDispositivosDto } from '../../dto/create-dispositivos.dto';

export class CreatePanelAlarmaDto extends OmitType(CreateDispositivosDto, [
  'idTipoDispositivo',
] as const) {
  @ApiProperty({
    description: 'Cuenta SIA del panel (dato exclusivo de PanelAlarma)',
    example: '1234',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cuentaSia!: string;

  @ApiProperty({
    description: 'Nombre del panel (dato exclusivo de PanelAlarma)',
    example: 'Panel sucursal norte',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({ description: 'IP del panel', maxLength: 45 })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  @ApiPropertyOptional({
    description: 'Cifrado AES activo (1) o inactivo (0)',
    enum: [0, 1],
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  cifradoActivo?: number;

  @ApiPropertyOptional({
    description: 'Clave AES (se almacena; no se devuelve en GET)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  aesKey?: string;

  @ApiPropertyOptional({
    description: 'Bits AES',
    enum: [128, 192, 256],
    example: 128,
  })
  @IsOptional()
  @IsInt()
  @IsIn([128, 192, 256])
  aesBits?: number;
}

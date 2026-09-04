import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateDispositivosDto {
  @ApiProperty({
    description: 'ID del cliente/tenant propietario. Obligatorio.',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  idCliente!: number;

  @ApiProperty({
    description:
      'ID del tipo (CatTipoDispositivo): rastreador, AVL, teléfono, etc. ' +
      'No usar el tipo panel aquí; el alta de paneles es POST /dispositivos/paneles. ' +
      'No usar TRACKCAM aquí; el alta es POST /dispositivos/trackcam.',
  })
  @IsInt()
  @IsNotEmpty()
  idTipoDispositivo!: number;

  @ApiProperty({
    description: 'Número de serie del dispositivo',
    example: '353456789012345',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroSerie!: string;

  @ApiPropertyOptional({
    description:
      'IMEI del equipo (clave de telemetría). Enviar como string para no perder dígitos (bigint en BD).',
    example: '8952020027196604527',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, {
    message: 'imei debe ser numérico de 1 a 20 dígitos',
  })
  imei?: string;

  @ApiPropertyOptional({ description: 'Número económico', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  eco?: string;

  @ApiPropertyOptional({ description: 'ID de marca (CatMarcas)' })
  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @ApiPropertyOptional({ description: 'ID de modelo (CatModelos)' })
  @IsOptional()
  @IsInt()
  idModelo?: number | null;
}

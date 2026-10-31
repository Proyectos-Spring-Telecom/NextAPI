import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateDispositivosDto {
  @ApiPropertyOptional({
    description:
      'Cliente al que se reserva. Sin él (o null) el equipo entra al almacén; solo operación (roles sin filtro de cliente) ' +
      'da de alta en almacén. Al instalarse toma el cliente de la instalación.',
    example: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  idCliente?: number | null;

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

  @ApiPropertyOptional({
    description: 'Indica si el dispositivo tiene cámara (0/1)',
    enum: [0, 1],
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  camara?: number;

  @ApiPropertyOptional({ description: 'ID de marca (CatMarcas)' })
  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @ApiPropertyOptional({ description: 'ID de modelo (CatModelos)' })
  @IsOptional()
  @IsInt()
  idModelo?: number | null;
}

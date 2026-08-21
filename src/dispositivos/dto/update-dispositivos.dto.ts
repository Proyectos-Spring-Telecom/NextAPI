import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateDispositivosDto {
  @ApiPropertyOptional({
    description: 'ID del tipo de dispositivo (CatTipoDispositivo)',
  })
  @IsOptional()
  @IsInt()
  idTipoDispositivo?: number;

  @ApiPropertyOptional({
    description: 'Número de serie del dispositivo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSerie?: string;

  @ApiPropertyOptional({
    description: 'IMEI del equipo (bigint, clave de telemetría)',
    example: 353456789012345,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  imei?: number | null;

  @ApiPropertyOptional({ description: 'Número económico', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  eco?: string | null;

  @ApiPropertyOptional({ description: 'ID de marca (CatMarcas)' })
  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @ApiPropertyOptional({ description: 'ID de modelo (CatModelos)' })
  @IsOptional()
  @IsInt()
  idModelo?: number | null;
}

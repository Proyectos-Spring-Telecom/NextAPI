import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
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
    description:
      'IMEI del equipo. String para no perder dígitos (bigint en BD). null para limpiar.',
    example: '8952020027196604527',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @Matches(/^\d{1,20}$/, {
    message: 'imei debe ser numérico de 1 a 20 dígitos',
  })
  imei?: string | null;

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

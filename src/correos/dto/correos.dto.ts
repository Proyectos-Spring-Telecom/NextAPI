import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Texto del multipart de `POST /correos/enviar` (el adjunto va en `archivo`). */
export class EnviarCorreoLibreDto {
  @ApiProperty({ description: 'De 1 a 5 correos separados por coma.', example: 'ana@cliente.com,luis@cliente.com' })
  @IsString()
  @IsNotEmpty({ message: 'Indica al menos un correo' })
  @MaxLength(1000)
  correos: string;

  @ApiPropertyOptional({ description: 'Por omisión: "Aviso de Spring Telecom".', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El asunto admite máximo 200 caracteres' })
  asunto?: string;

  @ApiPropertyOptional({ description: 'Texto plano con saltos de línea.', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'El mensaje admite máximo 4000 caracteres' })
  mensaje?: string;

  @ApiProperty({ description: 'De dónde se manda (hoy `informe-sucesos`).', example: 'informe-sucesos' })
  @IsString()
  @IsNotEmpty({ message: 'Falta el origen del correo' })
  @MaxLength(50)
  origen: string;

  @ApiPropertyOptional({ description: 'Id del registro relacionado (opcional).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idReferencia?: number;
}

/** Texto del multipart de `POST /correos/aviso-masivo` (el adjunto va en `archivo`). */
export class AvisoMasivoDto {
  @ApiProperty({ description: 'Ids de usuarios separados por coma (de `GET /usuarios/list`).', example: '12,45,78,101' })
  @IsString()
  @IsNotEmpty({ message: 'Elige al menos un usuario' })
  @MaxLength(20000)
  idUsuarios: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El asunto admite máximo 200 caracteres' })
  asunto?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'El mensaje admite máximo 4000 caracteres' })
  mensaje?: string;
}

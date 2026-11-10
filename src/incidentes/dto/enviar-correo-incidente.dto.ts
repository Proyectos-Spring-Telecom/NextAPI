import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos de texto del multipart de `POST /incidentes/:id/enviar-correo` (el PDF va en `file`). */
export class EnviarCorreoIncidenteDto {
  @ApiProperty({ description: 'De 1 a 5 correos, separados por coma o punto y coma.', example: 'cliente@empresa.com, otro@empresa.com' })
  @IsString()
  @IsNotEmpty({ message: 'Indica al menos un correo.' })
  @MaxLength(1000)
  correos: string;

  @ApiPropertyOptional({ description: 'Por omisión: "Reporte de incidencia #<id>".', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  asunto?: string;

  @ApiPropertyOptional({ description: 'Texto plano con saltos de línea (el que editó el monitorista).', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mensaje?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Solo los campos enviados se guardan en RelojConfig y se mandan al reloj. */
export class ConfiguracionRelojDto {
  @ApiPropertyOptional({ description: 'Intervalo de reporte en movimiento (s): UPLOAD.', example: 600 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  intervaloReporteSegundos?: number;

  @ApiPropertyOptional({ description: 'Detección de caída encendida (FALLDOWN).', example: true })
  @IsOptional()
  @IsBoolean()
  deteccionCaida?: boolean;

  @ApiPropertyOptional({ description: 'Llamar al número SOS al detectar caída (FALLDOWN).', example: true })
  @IsOptional()
  @IsBoolean()
  llamadaPorCaida?: boolean;

  @ApiPropertyOptional({ description: 'Sensibilidad de caída 1–6; mayor = menos sensible (LSSET).', example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  sensibilidadCaida?: number;
}

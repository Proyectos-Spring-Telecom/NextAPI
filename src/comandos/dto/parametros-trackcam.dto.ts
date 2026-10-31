import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PARAMETROS_TRACKCAM as P } from '../comandos-jt808';

const desc = (p: { id: number; etiqueta: string; unidad?: string; min: number; max: number }) =>
  `${p.etiqueta}${p.unidad ? ` (${p.unidad})` : ''}, ${p.min}–${p.max}. JT808 0x${p.id.toString(16).padStart(4, '0')}.`;

/** Solo los campos enviados se guardan como deseados y se mandan a la cámara (un solo PARAMS). */
export class ParametrosTrackCamDto {
  @ApiPropertyOptional({ description: desc(P.intervaloReporteSegundos), example: 179 })
  @IsOptional()
  @IsInt()
  @Min(P.intervaloReporteSegundos.min)
  @Max(P.intervaloReporteSegundos.max)
  intervaloReporteSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.intervaloReposoSegundos), example: 600 })
  @IsOptional()
  @IsInt()
  @Min(P.intervaloReposoSegundos.min)
  @Max(P.intervaloReposoSegundos.max)
  intervaloReposoSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.intervaloEmergenciaSegundos), example: 180 })
  @IsOptional()
  @IsInt()
  @Min(P.intervaloEmergenciaSegundos.min)
  @Max(P.intervaloEmergenciaSegundos.max)
  intervaloEmergenciaSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.estrategiaReporte), example: 0 })
  @IsOptional()
  @IsInt()
  @Min(P.estrategiaReporte.min)
  @Max(P.estrategiaReporte.max)
  estrategiaReporte?: number;

  @ApiPropertyOptional({ description: desc(P.distanciaReporteMetros), example: 500 })
  @IsOptional()
  @IsInt()
  @Min(P.distanciaReporteMetros.min)
  @Max(P.distanciaReporteMetros.max)
  distanciaReporteMetros?: number;

  @ApiPropertyOptional({ description: desc(P.anguloGiroGrados), example: 5 })
  @IsOptional()
  @IsInt()
  @Min(P.anguloGiroGrados.min)
  @Max(P.anguloGiroGrados.max)
  anguloGiroGrados?: number;

  @ApiPropertyOptional({ description: desc(P.velocidadMaximaKmh), example: 90 })
  @IsOptional()
  @IsInt()
  @Min(P.velocidadMaximaKmh.min)
  @Max(P.velocidadMaximaKmh.max)
  velocidadMaximaKmh?: number;

  @ApiPropertyOptional({ description: desc(P.duracionExcesoSegundos), example: 30 })
  @IsOptional()
  @IsInt()
  @Min(P.duracionExcesoSegundos.min)
  @Max(P.duracionExcesoSegundos.max)
  duracionExcesoSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.conduccionContinuaSegundos), example: 14400 })
  @IsOptional()
  @IsInt()
  @Min(P.conduccionContinuaSegundos.min)
  @Max(P.conduccionContinuaSegundos.max)
  conduccionContinuaSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.conduccionDiariaSegundos), example: 28800 })
  @IsOptional()
  @IsInt()
  @Min(P.conduccionDiariaSegundos.min)
  @Max(P.conduccionDiariaSegundos.max)
  conduccionDiariaSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.descansoMinimoSegundos), example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(P.descansoMinimoSegundos.min)
  @Max(P.descansoMinimoSegundos.max)
  descansoMinimoSegundos?: number;

  @ApiPropertyOptional({ description: desc(P.estacionamientoMaximoSegundos), example: 3600 })
  @IsOptional()
  @IsInt()
  @Min(P.estacionamientoMaximoSegundos.min)
  @Max(P.estacionamientoMaximoSegundos.max)
  estacionamientoMaximoSegundos?: number;
}

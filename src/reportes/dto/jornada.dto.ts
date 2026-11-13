import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { FILTROS_PASO_POR_POI, type FiltroPasoPorPoi } from './paso-por-poi.dto';

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Días máximos por consulta de jornada, motor o flota del día. */
export const MAX_DIAS_JORNADA = 31;

/**
 * Body de jornada, motor on/off y flota del día. Días completos de 00:00 a
 * 23:59; mismo `filtro` / `valores` que distancia.
 */
export class JornadaDto {
  @ApiPropertyOptional({
    description:
      'Cliente (opcional). Sin él, cubre todos los clientes del alcance del rol del token.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      '`imei` / `numeroSerie` → `Dispositivos`; `placa` / `economico` → `Vehiculos`. ' +
      'Sin él → todas las instalaciones del cliente.',
    enum: FILTROS_PASO_POR_POI,
    example: 'placa',
  })
  @IsOptional()
  @IsIn([...FILTROS_PASO_POR_POI], {
    message: `filtro debe ser uno de: ${FILTROS_PASO_POR_POI.join(', ')}`,
  })
  filtro?: FiltroPasoPorPoi;

  @ApiPropertyOptional({
    description:
      'Valores a buscar según `filtro` (1..N). Obligatorio si se envía `filtro`.',
    type: [String],
    example: ['PXP613F'],
  })
  @ValidateIf((o: JornadaDto) => o.filtro != null)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  valores?: string[];

  @ApiProperty({ description: 'Primer día (YYYY-MM-DD).', example: '2026-11-12' })
  @IsString()
  @Matches(DIA_RE, { message: 'fechaInicio debe ser YYYY-MM-DD' })
  fechaInicio!: string;

  @ApiPropertyOptional({
    description: `Último día (YYYY-MM-DD), inclusive. Sin él, solo \`fechaInicio\`. Máximo ${MAX_DIAS_JORNADA} días.`,
    example: '2026-11-12',
  })
  @IsOptional()
  @IsString()
  @Matches(DIA_RE, { message: 'fechaFinal debe ser YYYY-MM-DD' })
  fechaFinal?: string;
}

/** Body de paradas: el de jornada más un filtro opcional de duración. */
export class ParadasDto extends JornadaDto {
  @ApiPropertyOptional({
    description:
      'Solo paradas de al menos estos minutos. Sin él, todas (la regla del semáforo no tiene mínimo).',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1440)
  minutosMinimos?: number;
}

/** Body de entradas y salidas de geocerca: el de jornada más geocercas opcionales. */
export class GeocercasEventosDto extends JornadaDto {
  @ApiPropertyOptional({
    description: 'Solo estas geocercas. Sin él, todas las ligadas a los vehículos.',
    type: [Number],
    example: [12],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsGeocerca?: number[];
}

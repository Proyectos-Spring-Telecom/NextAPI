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
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Misma convención que histórico de monitoreo / `Posiciones.FechaHora`
 * (hora de pared, sin zona).
 */
const FECHA_REPORTE_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

export const FILTROS_PASO_POR_POI = [
  'imei',
  'numeroSerie',
  'placa',
  'economico',
] as const;

export type FiltroPasoPorPoi = (typeof FILTROS_PASO_POR_POI)[number];

export class PasoPorPoiDto {
  @ApiPropertyOptional({
    description:
      'Cliente del análisis (opcional). Sin él, el reporte cubre todos los clientes del alcance del rol del token. Con él, debe estar en ese alcance.' +
      ' Los POI deben pertenecer al alcance.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiProperty({
    description:
      'IDs de puntos de interés a evaluar (1..N). Todos deben pertenecer al cliente.',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsPuntoInteres!: number[];

  @ApiPropertyOptional({
    description:
      'Cómo interpretar `valores` para resolver instalaciones. ' +
      '`imei` / `numeroSerie` → `Dispositivos`; `placa` / `economico` → `Vehiculos`. ' +
      'Si se omite → todas las instalaciones activas del cliente con dispositivo e IMEI.',
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
      'Valores a buscar según `filtro` (1..N). Obligatorio si se envía `filtro`. ' +
      'Sin coincidencias → respuesta vacía (0 dispositivos / posiciones).',
    type: [String],
    example: ['ABC-123', 'XYZ-987'],
  })
  @ValidateIf((o: PasoPorPoiDto) => o.filtro != null)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  valores?: string[];

  @ApiProperty({
    description:
      'Inicio del periodo (inclusive). Formato: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO sin zona.',
    example: '2026-09-01 00:00:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_REPORTE_RE, {
    message:
      'fechaInicio debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaInicio!: string;

  @ApiProperty({
    description:
      'Fin del periodo (inclusive). Formato: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO sin zona.',
    example: '2026-09-14 23:59:59',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_REPORTE_RE, {
    message:
      'fechaFinal debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal!: string;
}

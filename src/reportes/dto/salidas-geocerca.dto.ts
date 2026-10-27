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
import {
  FILTROS_PASO_POR_POI,
  type FiltroPasoPorPoi,
} from './paso-por-poi.dto';

/**
 * Misma convención que histórico de monitoreo / `Posiciones.FechaHora`
 * (hora de pared, sin zona).
 */
const FECHA_REPORTE_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/** Estados posibles de un evento de salida de geocerca. */
export const ESTADOS_SALIDA_GEOCERCA = [
  'REINGRESO_DETECTADO',
  'SIN_REINGRESO',
] as const;

export type EstadoSalidaGeocerca =
  (typeof ESTADOS_SALIDA_GEOCERCA)[number];

/**
 * Body del reporte de salidas de geocerca.
 * Misma resolución de instalaciones que `posiciones` / paso-por-poi.
 * Una geocerca solo aplica a la instalación indicada en `Geocercas.IdInstalacion`
 * (misma regla que la evaluación en tiempo real en `posicion-ingest.service`);
 * las geocercas sin instalación asociada no se atribuyen a ningún dispositivo.
 */
export class ReporteSalidasGeocercaDto {
  @ApiProperty({
    description:
      'Cliente dueño del análisis. Debe estar en el alcance del rol del token. ' +
      'Las geocercas e instalaciones consultadas deben pertenecer a este cliente.',
    example: 15,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiPropertyOptional({
    description:
      'IDs de geocercas a evaluar (1..N). Todas deben pertenecer al cliente y estar activas; ' +
      'si alguna no existe o es de otro cliente se responde 404. ' +
      'Si se omite → todas las geocercas activas del cliente aplicables a las instalaciones autorizadas. ' +
      'Una geocerca solo se evalúa contra la instalación de su `IdInstalacion`.',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsGeocerca?: number[];

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
      'Sin coincidencias → respuesta vacía (0 salidas).',
    type: [String],
    example: ['ABC123'],
  })
  @ValidateIf((o: ReporteSalidasGeocercaDto) => o.filtro != null)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  valores?: string[];

  @ApiProperty({
    description:
      'Inicio del periodo (inclusive). Formato: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO sin zona.',
    example: '2026-10-01 00:00:00',
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
    example: '2026-10-20 23:59:59',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_REPORTE_RE, {
    message:
      'fechaFinal debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal!: string;

  @ApiPropertyOptional({
    description:
      'Página (1..N). Opcional. Si se envía `page` o `limit` la respuesta va paginada ' +
      '(`data.salidas` = solo esa página + `paginated`). Si se omiten ambos → todas las salidas (sin `paginated`).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Registros por página (1..200). Default 20 cuando se pagina.',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

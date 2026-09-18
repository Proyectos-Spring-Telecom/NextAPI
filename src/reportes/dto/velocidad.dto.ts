import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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

export class VelocidadDto {
  @ApiProperty({
    description:
      'Cliente dueño del análisis. Debe estar en el alcance del rol del token.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({
    description:
      'Velocidad mínima (km/h). Se incluyen posiciones con `Posiciones.Velocidad >= velocidad`.',
    example: 80,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  velocidad!: number;

  @ApiPropertyOptional({
    description:
      'Cómo interpretar `valores` para resolver instalaciones de **vehículos**. ' +
      '`imei` / `numeroSerie` → `Dispositivos`; `placa` / `economico` → `Vehiculos`. ' +
      'Si se omite → todas las instalaciones activas de productos vehículo del cliente.',
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
      'Sin coincidencias → respuesta vacía.',
    type: [String],
    example: ['ABC-123', 'XYZ-987'],
  })
  @ValidateIf((o: VelocidadDto) => o.filtro != null)
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

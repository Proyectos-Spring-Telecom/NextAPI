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
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { FILTROS_PASO_POR_POI, type FiltroPasoPorPoi } from './paso-por-poi.dto';

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/** Días máximos del reporte de odómetro (sale de la tabla de resumen diario). */
export const MAX_DIAS_ODOMETRO = 366;

/** Vehículos del alcance: mismo `filtro` / `valores` que distancia. */
export class ContadoresDto {
  @ApiPropertyOptional({
    description: 'Cliente (opcional). Sin él, todo el alcance del token.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({ enum: FILTROS_PASO_POR_POI, example: 'placa' })
  @IsOptional()
  @IsIn([...FILTROS_PASO_POR_POI], {
    message: `filtro debe ser uno de: ${FILTROS_PASO_POR_POI.join(', ')}`,
  })
  filtro?: FiltroPasoPorPoi;

  @ApiPropertyOptional({ type: [String], example: ['PXP613F'] })
  @ValidateIf((o: ContadoresDto) => o.filtro != null)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  valores?: string[];
}

export class OdometroDto extends ContadoresDto {
  @ApiProperty({ description: 'Primer día (YYYY-MM-DD).', example: '2026-11-01' })
  @IsString()
  @Matches(DIA_RE, { message: 'fechaInicio debe ser YYYY-MM-DD' })
  fechaInicio!: string;

  @ApiProperty({
    description: `Último día (YYYY-MM-DD), inclusive. Máximo ${MAX_DIAS_ODOMETRO} días.`,
    example: '2026-11-13',
  })
  @IsString()
  @Matches(DIA_RE, { message: 'fechaFinal debe ser YYYY-MM-DD' })
  fechaFinal!: string;
}

/** Lectura del tablero: odómetro y/o horas de motor a una fecha. */
export class AjusteContadoresDto {
  @ApiPropertyOptional({ description: 'Kilometraje del tablero.', example: 215097 })
  @ValidateIf((o: AjusteContadoresDto) => o.horasMotor == null || o.km != null)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'km debe ser un número (manda km, horasMotor o ambos)' },
  )
  @Min(0)
  @Max(9_999_999)
  km?: number;

  @ApiPropertyOptional({ description: 'Horas de motor del tablero.', example: 5120.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999)
  horasMotor?: number;

  @ApiPropertyOptional({
    description:
      'Cuándo se leyó (hora de México). Sin ella, ahora. El acumulado suma desde el día siguiente.',
    example: '2026-11-13 08:00:00',
  })
  @IsOptional()
  @IsString()
  @Matches(FECHA_HORA_RE, { message: 'fecha debe ser YYYY-MM-DD o YYYY-MM-DD HH:mm:ss' })
  fecha?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

/**
 * Misma convención que histórico de monitoreo / `Posiciones.FechaHora`
 * (hora de pared, sin zona).
 */
const FECHA_REPORTE_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

export class PasoPorPoiDto {
  @ApiProperty({
    description:
      'Cliente dueño del análisis. Debe estar en el alcance del rol del token. ' +
      'El POI debe pertenecer a este cliente.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({
    description: 'ID del punto de interés a evaluar (del cliente indicado)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPuntoInteres!: number;

  @ApiPropertyOptional({
    description:
      'Instalaciones a analizar (1..N). Si se omite o viene vacío, se evalúan ' +
      'todas las instalaciones activas del cliente con dispositivo no-panel e IMEI. ' +
      'Los paneles de alarma se excluyen siempre.',
    type: [Number],
    example: [10, 11, 12],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsInstalacion?: number[];

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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const FECHA_REPORTE_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/**
 * Body del reporte de salidas de geocerca por UNA sola instalación.
 * El cliente se deriva de la instalación (`Instalaciones.IdCliente`) y se
 * valida contra el alcance del token; no se aceptan listas de instalaciones.
 */
export class ReporteSalidasGeocercaInstalacionDto {
  @ApiProperty({
    description:
      'Instalación seleccionada (obligatoria, una sola). Debe existir, estar activa, ' +
      'tener dispositivo GPS con IMEI (no panel de alarma) y pertenecer a un cliente ' +
      'visible según el rol del token.',
    example: 125,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion!: number;

  @ApiPropertyOptional({
    description:
      'IDs de geocercas a evaluar (1..N). Deben pertenecer al cliente de la instalación, ' +
      'estar activas y estar asociadas a esta instalación (`Geocercas.IdInstalacion`). ' +
      'Inexistentes o de otro cliente → 404; de este cliente pero asociadas a otra ' +
      'instalación → 400. Si se omite → todas las geocercas activas asociadas a la instalación.',
    type: [Number],
    example: [10, 15],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsGeocerca?: number[];

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
}

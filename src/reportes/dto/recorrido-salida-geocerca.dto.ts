import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const FECHA_REPORTE_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/**
 * Body del recorrido posterior a UNA salida de geocerca de una instalación.
 * El evento se identifica con la clave compuesta
 * (idInstalacion, idGeocerca, fechaSalida, idPosicionSalida opcional) y el
 * backend verifica que corresponda a una salida real detectada; no basta
 * con que el cliente envíe una fecha.
 */
export class RecorridoSalidaGeocercaDto {
  @ApiProperty({
    description: 'Instalación seleccionada (obligatoria, una sola).',
    example: 125,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion!: number;

  @ApiProperty({
    description:
      'Geocerca del evento. Debe pertenecer al cliente de la instalación, estar activa ' +
      'y ser del vehículo de esta instalación (`Geocercas.IdProducto`).',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idGeocerca!: number;

  @ApiProperty({
    description:
      'Fecha/hora de salida del evento seleccionado, tal como la devolvió el listado ' +
      '`salidas-geocerca-instalacion` (`fechaSalida` = primera posición fuera detectada). ' +
      'Se verifica contra una salida real; si no existe → 404.',
    example: '2026-10-20 16:22:24',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_REPORTE_RE, {
    message: 'fechaSalida debe ser YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaSalida!: string;

  @ApiPropertyOptional({
    description:
      'ID de la posición de salida (`primeraPosicionFuera.idPosicion` del listado). ' +
      'Desambigua eventos con la misma fecha/hora; si se envía y no coincide → 404.',
    example: 1001,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPosicionSalida?: number;

  @ApiPropertyOptional({
    description:
      'Contexto inicial para verificar el evento (inclusive). El recorrido efectivo ' +
      'siempre inicia en `fechaSalida`, nunca antes: un `fechaInicio` anterior solo ' +
      'aporta contexto de detección. Si se omite, se usa `fechaSalida`.',
    example: '2026-10-20 16:22:24',
  })
  @IsOptional()
  @IsString()
  @Matches(FECHA_REPORTE_RE, {
    message: 'fechaInicio debe ser YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({
    description:
      'Fin del rango del recorrido (inclusive). Obligatoria salvo que ' +
      '`hastaUltimaPosicion` sea `true`. Nunca se consulta sin límite temporal ' +
      'de manera accidental.',
    example: '2026-10-20 23:59:59',
  })
  @IsOptional()
  @IsString()
  @Matches(FECHA_REPORTE_RE, {
    message: 'fechaFinal debe ser YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal?: string;

  @ApiPropertyOptional({
    description:
      'Modo explícito: si es `true` y se omite `fechaFinal`, el recorrido llega hasta ' +
      'la última posición GPS disponible de la instalación (dentro de su vigencia). ' +
      'Si se envía `fechaFinal`, esta actúa como tope. Por defecto `false`.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hastaUltimaPosicion?: boolean;

  @ApiPropertyOptional({
    description: 'Tamaño de página del recorrido (1..1000, por defecto 500).',
    example: 500,
    default: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limite?: number;

  @ApiPropertyOptional({
    description:
      'Cursor opaco de paginación (`paginacion.cursorSiguiente` de la respuesta previa). ' +
      'Codifica la última posición devuelta (fechaHora + id); no debe construirse a mano.',
    example: 'MjAyNi0xMC0yMFQxNjIyMjQxfDEwMDE',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
}

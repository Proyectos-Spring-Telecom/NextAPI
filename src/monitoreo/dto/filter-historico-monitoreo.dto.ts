import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Acepta ISO (`2026-09-02T13:28:00`) o formato legacy (`2026-09-02 13:28:00`).
 */
const FECHA_HISTORICO_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

export class FilterHistoricoMonitoreoDto {
  @ApiProperty({
    description: 'Inicio del rango (inclusive)',
    example: '2026-09-02 13:28:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_HISTORICO_RE, {
    message:
      'fechaInicio debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaInicio!: string;

  @ApiProperty({
    description: 'Fin del rango (inclusive). Alias legacy: fechaFinal',
    example: '2026-09-02 14:29:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_HISTORICO_RE, {
    message:
      'fechaFinal debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal!: string;
}

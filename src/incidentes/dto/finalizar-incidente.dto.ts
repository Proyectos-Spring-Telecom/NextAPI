import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Datos del reporte final. Se guardan en lo que ya existe (sin columnas nuevas):
 * - `descripcion` → Incidentes.Descripcion ("Descripción de la incidencia").
 * - `resultado`   → seguimiento con medio "Resultado final".
 * - `conclusion`  → seguimiento con medio "Cierre" (último del reporte).
 */
export class FinalizarIncidenteDto {
  @ApiPropertyOptional({
    description: 'Descripción de la incidencia (reemplaza la del incidente).',
    example: 'Se recibe alerta primaria de la unidad Eco 12; se inicia protocolo.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Resultado final (resumen corto).',
    example: 'Falsa alarma confirmada con el operador.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resultado?: string;

  @ApiPropertyOptional({
    description: 'Conclusión del reporte.',
    example: 'Se mantuvo comunicación con el operador hasta confirmar que todo está en orden.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conclusion?: string;
}

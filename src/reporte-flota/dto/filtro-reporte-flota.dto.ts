import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SITUACIONES, SituacionUnidad } from '../reporte-flota.reglas';

export class FiltroReporteFlotaDto {
  @ApiPropertyOptional({
    description: 'Qué unidades listar (el resumen siempre cuenta todas). Por defecto `movimiento`.',
    enum: [...SITUACIONES, 'todas'],
    default: 'movimiento',
  })
  @IsOptional()
  @IsIn([...SITUACIONES, 'todas'])
  situacion?: SituacionUnidad | 'todas';
}

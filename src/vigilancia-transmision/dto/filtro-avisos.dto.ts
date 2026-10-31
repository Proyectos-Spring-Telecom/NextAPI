import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { ESTATUS_AVISO, type EstatusAviso } from '../vigilancia-transmision.reglas';

export class FiltroAvisosDto {
  @ApiPropertyOptional({ enum: ESTATUS_AVISO, description: 'Sin estatus: los vivos (abierto y atendido).' })
  @IsOptional()
  @IsIn([...ESTATUS_AVISO])
  estatus?: EstatusAviso;

  @ApiPropertyOptional({ description: 'Día de la evaluación, `YYYY-MM-DD`.', example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener el formato YYYY-MM-DD.' })
  fecha?: string;
}

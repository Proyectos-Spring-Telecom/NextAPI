import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { RESULTADOS_AVISO, type ResultadoAviso } from '../vigilancia-transmision.reglas';

export class AtenderAvisoDto {
  @ApiProperty({
    enum: RESULTADOS_AVISO,
    description:
      'Resultado de la revisión: falla del equipo, taller (pausa la vigilancia hasta `fechaRegreso`), ' +
      'proveedor (telefonía o plataforma), cliente avisado u otro.',
    example: 'taller',
  })
  @IsIn([...RESULTADOS_AVISO], { message: `resultado debe ser uno de: ${RESULTADOS_AVISO.join(', ')}` })
  resultado: ResultadoAviso;

  @ApiPropertyOptional({ example: 'El cliente reporta que la unidad entró a servicio.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;

  @ApiPropertyOptional({
    description: 'Obligatoria con `taller`: fecha de regreso, hora de México (`YYYY-MM-DD HH:mm:ss`). Debe ser futura.',
    example: '2026-11-04 09:00:00',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/, { message: 'fechaRegreso debe tener el formato YYYY-MM-DD HH:mm:ss.' })
  fechaRegreso?: string;
}

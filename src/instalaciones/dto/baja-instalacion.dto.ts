import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  EnumEstatusInstalacion,
  ESTATUS_INSTALACION_PATCH,
} from 'src/common/estatus.enum';

export class BajaInstalacionDto {
  @ApiProperty({
    description:
      'Estatus de la instalación. Solo: 0=inactivo, 1=activa, 5=inservible. ' +
      '0 y 5: componentes a disponible (1) y fila Estatus=0 (SimActivo/DispositivoActivo nulos). ' +
      '1: requiere componentes en disponible (1); luego componentes a asignado (2) y fila Estatus=1.',
    enum: ESTATUS_INSTALACION_PATCH,
    example: EnumEstatusInstalacion.INACTIVO,
  })
  @IsIn([...ESTATUS_INSTALACION_PATCH], {
    message:
      'El estatus indicado no es válido. Solo se permiten 0 (inactivo), 1 (activa) o 5 (inservible).',
  })
  estatusInstalacion: EnumEstatusInstalacion;

  @ApiPropertyOptional({
    description: 'Motivo u observaciones (se registra en bitácora).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}

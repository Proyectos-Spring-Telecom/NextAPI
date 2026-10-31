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
      '0 y 5: archiva el periodo; dispositivo a por revisar (3) o inservible (5) si la baja es 5, SIM a por revisar (3), producto a activo (1). ' +
      '1: requiere componentes disponibles (1, revisados); pasan a instalado (2) y se abre una versión nueva.',
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

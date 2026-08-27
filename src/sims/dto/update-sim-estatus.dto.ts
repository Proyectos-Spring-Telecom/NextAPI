import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';
import {
  EnumEstatusRecurso,
  ESTATUS_SIM_PATCH,
} from 'src/common/estatus.enum';

export class UpdateSimEstatusDto {
  @ApiProperty({
    description:
      'Estatus destino: 0=inactivo, 1=activo (disponible), 2=asignado, ' +
      '3=revision, 4=baja_mantenimiento, 5=inservible',
    enum: ESTATUS_SIM_PATCH,
    example: EnumEstatusRecurso.INACTIVO,
  })
  @IsInt()
  @IsNotEmpty()
  @IsIn([...ESTATUS_SIM_PATCH], {
    message:
      'estatus debe ser 0 (inactivo), 1 (activo), 2 (asignado), 3 (revision), 4 (baja_mantenimiento) o 5 (inservible)',
  })
  estatus!: EnumEstatusRecurso;
}

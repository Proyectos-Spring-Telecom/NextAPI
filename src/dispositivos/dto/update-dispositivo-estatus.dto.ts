import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';
import {
  EnumEstatusProductoDispositivo,
  ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
} from 'src/common/estatus.enum';

export class UpdateDispositivoEstatusDto {
  @ApiProperty({
    description:
      'Estatus destino: 0=inactivo, 1=activo (disponible), 2=asignado, ' +
      '3=baja_remplazo, 4=baja_mantenimiento, 5=inservible',
    enum: ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
    example: EnumEstatusProductoDispositivo.INACTIVO,
  })
  @IsInt()
  @IsNotEmpty()
  @IsIn([...ESTATUS_PRODUCTO_DISPOSITIVO_PATCH], {
    message:
      'estatus debe ser 0 (inactivo), 1 (activo), 2 (asignado), 3 (baja_remplazo), 4 (baja_mantenimiento) o 5 (inservible)',
  })
  estatus!: EnumEstatusProductoDispositivo;
}

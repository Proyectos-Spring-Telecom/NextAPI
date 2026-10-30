import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  EnumEstatusProductoDispositivo,
  ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
} from 'src/common/estatus.enum';

export class UpdateDispositivoEstatusDto {
  @ApiProperty({
    description:
      'Estatus destino (CatEstatusRecurso): 0=inactivo, 1=disponible, 3=por revisar, 4=laboratorio, 5=inservible. ' +
      'El 2 (instalado) solo lo pone una instalación. Cambios permitidos: GET /estatus-recurso.',
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

  @ApiPropertyOptional({
    description: 'Motivo del cambio; queda en el historial del recurso. Obligatorio para corregir un inservible (5).',
    example: 'Revisado en almacén: funciona',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

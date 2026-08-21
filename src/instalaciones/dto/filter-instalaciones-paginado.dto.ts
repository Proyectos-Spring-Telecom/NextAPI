import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { EnumTipoProducto } from 'src/common/estatus.enum';

export class FilterInstalacionesPaginadoDto {
  @ApiProperty({ description: 'Número de página (desde 1)', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page!: number;

  @ApiProperty({ description: 'Registros por página', example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit!: number;

  @ApiProperty({
    description:
      'Tipo de producto a listar: 1=vehículo, 2=activo, 3=inmueble, 4=persona',
    enum: [
      EnumTipoProducto.VEHICULO,
      EnumTipoProducto.ACTIVO,
      EnumTipoProducto.INMUEBLE,
      EnumTipoProducto.PERSONA,
    ],
    example: EnumTipoProducto.VEHICULO,
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([
    EnumTipoProducto.VEHICULO,
    EnumTipoProducto.ACTIVO,
    EnumTipoProducto.INMUEBLE,
    EnumTipoProducto.PERSONA,
  ], {
    message: 'idTipoProducto debe ser 1 (vehículo), 2 (activo), 3 (inmueble) o 4 (persona)',
  })
  idTipoProducto!: EnumTipoProducto;
}

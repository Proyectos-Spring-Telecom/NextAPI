import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { EnumCatProducto } from 'src/common/estatus.enum';

export class CreateCatMarcasDto {
  @ApiProperty({
    description: 'Nombre de la marca',
    example: 'Toyota',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    description:
      'ID de CatProductos: 1 Dispositivo, 2 Vehiculo, 3 Activo, 4 Telefono, 5 Panel',
    enum: EnumCatProducto,
    enumName: 'EnumCatProducto',
    example: EnumCatProducto.VEHICULO,
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  idProducto!: number;
}

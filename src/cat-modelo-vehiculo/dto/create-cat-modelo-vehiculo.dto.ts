import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCatModeloVehiculoDto {
  @ApiProperty({
    description: 'Nombre del modelo de vehículo',
    example: 'Ranger',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'ID de la marca de vehículo (CatMarcaVehiculo)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  idMarcaVehiculo: number;

  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}

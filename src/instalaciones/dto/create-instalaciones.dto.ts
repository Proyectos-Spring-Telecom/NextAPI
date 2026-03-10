import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({ description: 'ID dispositivo (debe pertenecer al mismo cliente)' })
  @IsInt()
  @IsNotEmpty()
  idDispositivo: number;

  @ApiProperty({ description: 'ID vehículo (debe pertenecer al mismo cliente)' })
  @IsInt()
  @IsNotEmpty()
  idVehiculo: number;

  @ApiProperty({
    description: 'ID estatus (CatEstatusInstalacion)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  idEstatusInstalacion?: number = 1;

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

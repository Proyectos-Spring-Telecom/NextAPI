import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({
    description: 'ID dispositivo (debe pertenecer al mismo cliente)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idDispositivo?: number | null;

  @ApiProperty({ description: 'ID vehículo (debe pertenecer al mismo cliente)' })
  @IsInt()
  @IsNotEmpty()
  idVehiculo: number;

  @ApiProperty({
    description: 'ID activo (pendiente — sin FK en BD)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idActivos?: number;

  @ApiProperty({
    description: 'ID portátil (pendiente — sin FK en BD)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idPortatiles?: number;

  @ApiProperty({
    description: 'Estatus de instalación (valor numérico)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  estatusInstalacion?: number = 1;

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

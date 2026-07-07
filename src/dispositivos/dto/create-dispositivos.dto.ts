import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDispositivosDto {
  @ApiProperty({
    description: 'Número de serie / IMEI del dispositivo GPS',
    example: '353456789012345',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroSerie: string;

  @ApiProperty({
    description: 'ID marca (CatMarcas)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idMarcaDispositivo?: number | null;

  @ApiProperty({
    description: 'ID modelo (CatModelos)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idModeloDispositivo?: number | null;

  @ApiProperty({
    description: 'Estatus operativo del dispositivo (bigint, default 1)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  estatusDispositivo?: number = 1;

  @ApiProperty({
    description: 'ID SIM asignado',
    required: true,
  })
  @IsNotEmpty()
  @IsInt()
  idSim: number;

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

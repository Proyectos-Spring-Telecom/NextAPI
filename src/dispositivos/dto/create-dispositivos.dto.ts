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
    description: 'ID del tipo de dispositivo (CatTipoDispositivo)',
  })
  @IsInt()
  @IsNotEmpty()
  idTipoDispositivo: number;

  @ApiProperty({
    description: 'Número de serie del dispositivo',
    example: '353456789012345',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroSerie: string;

  @ApiProperty({
    description: 'IMEI del dispositivo',
    maxLength: 20,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  imei?: string;

  @ApiProperty({
    description: 'Número económico',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  eco?: string;

  @ApiProperty({
    description: 'ID de marca (CatMarcas)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @ApiProperty({
    description: 'ID de modelo (CatModelos)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idModelo?: number | null;

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

import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSimsDto {
  @ApiProperty({
    description: 'IMEI/identificador en red (opcional)',
    maxLength: 15,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  imei?: string;

  @ApiProperty({
    description: 'Número de teléfono / MSISDN',
    maxLength: 20,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroTelefono?: string;

  @ApiProperty({ description: 'ID compañía telefónica (CatTelefonia)' })
  @IsInt()
  @IsNotEmpty()
  idTelefonia: number;

  @ApiProperty({ description: 'ID plan de datos (CatPlanesTelefonia)' })
  @IsInt()
  @IsNotEmpty()
  idPlanTelefonia: number;

  @ApiProperty({
    description: 'Estatus operativo del SIM (tinyint, default 1)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  estatusSim?: number = 1;

  @ApiProperty({
    description: 'Fecha de activación (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fechaActivacion?: string;

  @ApiProperty({
    description: 'Fecha de vencimiento (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiProperty({ description: 'Notas', maxLength: 500, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

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

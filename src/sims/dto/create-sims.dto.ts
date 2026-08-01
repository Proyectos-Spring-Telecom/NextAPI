import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSimsDto {
  @ApiPropertyOptional({
    description: 'IMEI/identificador en red',
    maxLength: 15,
    example: '356938035643809',
  })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  imei?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono / MSISDN',
    maxLength: 20,
    example: '5512345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroTelefono?: string;

  @ApiProperty({
    description: 'ID compañía telefónica (CatTelefonia)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  idTelefonia!: number;

  @ApiProperty({
    description: 'ID plan de datos (CatPlanesTelefonia)',
    example: 3,
  })
  @IsInt()
  @IsNotEmpty()
  idPlanTelefonia!: number;

  @ApiPropertyOptional({
    description: 'Fecha de activación (YYYY-MM-DD)',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString()
  fechaActivacion?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento (YYYY-MM-DD)',
    example: '2027-01-15',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiPropertyOptional({
    description: 'Notas',
    maxLength: 500,
    example: 'SIM asignada a unidad 45',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

}

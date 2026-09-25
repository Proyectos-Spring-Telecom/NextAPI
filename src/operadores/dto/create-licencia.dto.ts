import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLicenciaDto {
  @ApiProperty({
    description: 'Número oficial de la licencia (único global)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroLicencia!: string;

  @ApiProperty({ description: 'ID tipo licencia (CatTipoLicencia)' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  idTipoLicencia!: number;

  @ApiProperty({ description: 'ID categoría licencia (CatCategoriaLicencia)' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  idCategoriaLicencia!: number;

  @ApiProperty({
    description: 'Fecha expedición (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsString()
  @IsNotEmpty()
  fechaExpedicion!: string;

  @ApiProperty({
    description: 'Fecha vencimiento (YYYY-MM-DD)',
    example: '2028-01-15',
  })
  @IsString()
  @IsNotEmpty()
  fechaVencimiento!: string;

  @ApiProperty({
    description:
      'URL o archivo (PNG/JPEG/PDF) del documento escaneado. Obligatorio en create.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  licencia!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  transformOptionalNumber,
  transformOptionalString,
} from 'src/common/transforms/form-data.transforms';

export class CreateVehiculosDto {
  @ApiProperty({ description: 'ID del producto asociado' })
  @Transform(transformOptionalNumber)
  @IsInt()
  @IsNotEmpty()
  idProducto!: number;

  @ApiProperty({
    description: 'Placas oficiales (S/P si no tiene)',
    example: 'ABC1234',
    maxLength: 10,
  })
  @Transform(transformOptionalString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  placa!: string;

  @ApiPropertyOptional({
    description: 'Número interno de flota',
    example: 'VH-001',
    maxLength: 50,
  })
  @Transform(transformOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroEconomico?: string;

  @ApiPropertyOptional({
    description: 'ID marca (CatMarcas)',
  })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsInt()
  idMarcaVehiculo?: number | null;

  @ApiPropertyOptional({
    description: 'ID modelo (CatModelos)',
  })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsInt()
  idModeloVehiculo?: number | null;

  @ApiPropertyOptional({ description: 'Año modelo', example: 2024 })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1900)
  anio?: number;

  @ApiPropertyOptional({ description: 'Color', maxLength: 30 })
  @Transform(transformOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({
    description: 'VIN / Número de serie',
    maxLength: 20,
  })
  @Transform(transformOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroSerie?: string;

  @ApiPropertyOptional({
    description: 'ID combustible (CatTipoCombustible)',
  })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsInt()
  idCombustible?: number;

  @ApiPropertyOptional({ description: 'Kilometraje del vehículo' })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsNumber()
  km?: number;

  @ApiPropertyOptional({ description: 'Capacidad del tanque en litros' })
  @Transform(transformOptionalNumber)
  @IsOptional()
  @IsNumber()
  capacidadLitros?: number;

}

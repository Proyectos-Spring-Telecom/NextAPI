import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehiculosDto {
  @ApiProperty({
    description: 'Placas oficiales (S/P si no tiene)',
    example: 'ABC1234',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  placa: string;

  @ApiProperty({
    description: 'Número interno de flota',
    example: 'VH-001',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroEconomico: string;

  @ApiProperty({
    description: 'ID marca (CatMarcas)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idMarcaVehiculo?: number | null;

  @ApiProperty({
    description: 'ID modelo (CatModelos)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idModeloVehiculo?: number | null;

  @ApiProperty({ description: 'Año modelo', example: 2024 })
  @IsInt()
  @IsNotEmpty()
  @Min(1900)
  anio: number;

  @ApiProperty({ description: 'Color', maxLength: 30, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiProperty({
    description: 'VIN / Número de serie',
    maxLength: 20,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroSerie?: string;

  @ApiProperty({ description: 'URL imagen principal S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  foto?: string;

  @ApiProperty({ description: 'URL FotoFrente S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoFrente?: string;

  @ApiProperty({ description: 'URL FotoTrasera S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoTrasera?: string;

  @ApiProperty({ description: 'URL FotoDerecha S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoDerecha?: string;

  @ApiProperty({ description: 'URL FotoIzquierda S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoIzquierda?: string;

  @ApiProperty({ description: 'URL FotoExtra S3', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoExtra?: string;

  @ApiProperty({ description: 'URL TarjetaCirculacion', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tarjetaCirculacion?: string;

  @ApiProperty({ description: 'URL PolizaSeguro', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  polizaSeguro?: string;

  @ApiProperty({ description: 'URL PermisoConcesion', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  permisoConcesion?: string;

  @ApiProperty({ description: 'URL InspeccionMecanica', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspeccionMecanica?: string;

  @ApiProperty({
    description: 'ID combustible (CatTipoCombustible)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idCombustible?: number;

  @ApiProperty({ description: 'KM por litro', required: false })
  @IsOptional()
  @IsNumber()
  km?: number;

  @ApiProperty({ description: 'Capacidad tanque (litros)', required: false })
  @IsOptional()
  @IsNumber()
  capacidadLitros?: number;

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

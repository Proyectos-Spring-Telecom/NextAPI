import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePuntoInteresDto {
  @ApiPropertyOptional({
    description:
      'Cliente del punto. Obligatorio para monitoreo y administración (roles 1–5 y 8). ' +
      'Los accesos del cliente (6, 7, 9…): opcional, por defecto su cliente; puede ser uno de sus clientes hijos.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiProperty({
    description: 'Nombre del punto de interés',
    example: 'Base Norte',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Descripción',
    maxLength: 500,
    example: 'Punto de control acceso norte',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ description: 'Longitud', example: -99.133209 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ description: 'Latitud', example: 19.432608 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiPropertyOptional({
    description: 'Radio del punto en metros (geocerca circular)',
    default: 25,
    example: 25,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radioMetros?: number;

  @ApiPropertyOptional({
    description: 'URL o clave del icono en mapa',
    maxLength: 500,
    example: 'https://cdn.example.com/icons/poi-base.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icono?: string;

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      'Vehículos (productos) que avisan llegada y salida de este punto; lista definitiva (en la edición: omitir = no cambiar, `[]` = ninguno). ' +
      'Cada vehículo debe ser del cliente del punto o de uno de sus clientes hijos.',
    example: [1000210],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsProducto?: number[];
}

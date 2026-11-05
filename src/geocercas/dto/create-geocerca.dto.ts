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
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGeocercaDto {
  @ApiPropertyOptional({
    description:
      'Cliente de la geocerca. Obligatorio para monitoreo y administración (roles 1–5 y 8). ' +
      'Los accesos del cliente (6, 7, 9…): opcional, por defecto su cliente; puede ser uno de sus clientes hijos.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      '**Obsoleto:** usar `idsProducto`. Equivale a `idsProducto: [idProducto]`.',
    example: 1000210,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idProducto?: number | null;

  @ApiPropertyOptional({
    description: '**Obsoleto:** usar `idsProducto`. Si se envía, liga el vehículo de esa instalación.',
    example: 10,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion?: number | null;

  @ApiProperty({
    description: 'Nombre de la geocerca',
    example: 'Zona industrial norte',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Descripción',
    maxLength: 500,
    example: 'Perímetro de la planta norte',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({
    description: 'Geometría / GeoJSON de la geocerca (objeto o arreglo JSON)',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [-99.14, 19.43],
          [-99.13, 19.43],
          [-99.13, 19.44],
          [-99.14, 19.44],
          [-99.14, 19.43],
        ],
      ],
    },
  })
  @IsNotEmpty()
  geocerca!: Record<string, unknown> | unknown[];

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      'Vehículos (productos) a los que aplica la geocerca; lista definitiva. ' +
      'Cada vehículo debe ser del cliente de la geocerca o de uno de sus clientes hijos. ' +
      'Solo con vehículos ligados se evalúa la salida (Estado 8) y entra a los reportes.',
    example: [1000210, 1000211],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsProducto?: number[];

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: '**Obsoleto, se ignora** (5/11/2026): la geocerca es del cliente y la usan todos sus usuarios.',
    deprecated: true,
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  usuariosIds?: number[];
}
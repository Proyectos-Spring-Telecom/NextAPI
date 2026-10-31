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
      'ID del cliente propietario. Obligatorio para roles globales/admin. ' +
      'Roles Cliente (6) y Usuario (9): se ignora y se usa el `idCliente` del token.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      'Vehículo (producto) al que aplica la geocerca; debe ser del mismo cliente. La geocerca sigue al vehículo ' +
      'aunque cambie el equipo o tenga varias instalaciones (GPS + TrackCam). Sin vehículo no se evalúa.',
    example: 1000210,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idProducto?: number | null;

  @ApiPropertyOptional({
    description: '**Obsoleto:** usar `idProducto`. Si se envía, la geocerca toma el vehículo de esa instalación.',
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
      'IDs de usuarios a vincular en UsuariosGeocerca. ' +
      'Roles Cliente (6) y Usuario (9): opcional; si se omite o viene vacío se usa el usuario del token. ' +
      'Resto de roles: obligatorio, al menos un ID.',
    example: [5, 12],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  usuariosIds?: number[];
}
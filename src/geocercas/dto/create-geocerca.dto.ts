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
      'ID de instalación asociada (opcional). Debe pertenecer al mismo cliente.',
    example: 10,
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
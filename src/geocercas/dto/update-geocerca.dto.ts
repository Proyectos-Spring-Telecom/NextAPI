import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGeocercaDto {
  @ApiPropertyOptional({
    description:
      'ID del cliente propietario. Roles Cliente (6) y Usuario (9): queda fijado al del token.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      'Vehículo (producto) al que aplica (null para desvincular). Debe pertenecer al cliente de la geocerca.',
    example: 1000210,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idProducto?: number | null;

  @ApiPropertyOptional({
    description: '**Obsoleto:** usar `idProducto`. Si se envía, la geocerca toma el vehículo de esa instalación (null = desvincular).',
    example: 10,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idInstalacion?: number | null;

  @ApiPropertyOptional({
    description: 'Nombre de la geocerca',
    example: 'Zona industrial norte',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Descripción (string vacío → null)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Geometría / GeoJSON de la geocerca',
  })
  @IsOptional()
  geocerca?: Record<string, unknown> | unknown[];

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      'Lista definitiva de usuarios activos en UsuariosGeocerca. ' +
      'Omitir = no modificar. Enviar [] para desactivar todos.',
    example: [5, 12],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  usuariosIds?: number[];
}

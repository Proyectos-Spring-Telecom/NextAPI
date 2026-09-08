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
      'ID de instalación (null para desvincular). Debe pertenecer al cliente de la geocerca.',
    example: 10,
    nullable: true,
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

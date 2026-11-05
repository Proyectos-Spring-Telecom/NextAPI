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
      'Cambiar el cliente de la geocerca (dentro del alcance del token). Sus vehículos ligados deben ser del cliente nuevo o de sus hijos.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      '**Obsoleto:** usar `idsProducto`. Equivale a `idsProducto: [idProducto]` (null = `[]`).',
    example: 1000210,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idProducto?: number | null;

  @ApiPropertyOptional({
    description: '**Obsoleto:** usar `idsProducto`. Liga solo el vehículo de esa instalación (null = `[]`).',
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
      'Vehículos (productos) a los que aplica la geocerca; lista definitiva. Omitir = no cambiar; `[]` = quitar todos. ' +
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

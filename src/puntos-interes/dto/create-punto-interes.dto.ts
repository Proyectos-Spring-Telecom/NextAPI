import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
      'ID del cliente propietario. Obligatorio para roles globales/admin. ' +
      'Roles Cliente (6) y Usuario (9): se ignora y se usa el `idCliente` del token.',
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
    description: 'URL o clave del icono en mapa',
    maxLength: 500,
    example: 'https://cdn.example.com/icons/poi-base.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icono?: string;
}

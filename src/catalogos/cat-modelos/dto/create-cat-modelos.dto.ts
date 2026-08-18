import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCatModelosDto {
  @ApiProperty({
    description: 'Nombre del modelo',
    example: 'Corolla',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Descripción del modelo',
    example: 'Sedán compacto',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;

  @ApiProperty({
    description: 'ID de la marca (CatMarcas)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  idCatMarcas!: number;
}

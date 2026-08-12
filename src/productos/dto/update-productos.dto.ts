import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProductosDto {
  @ApiPropertyOptional({
    description: 'Etiqueta legible del producto',
    example: 'Unidad 45',
    maxLength: 400,
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  nombre?: string;
}

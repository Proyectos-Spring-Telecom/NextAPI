import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActivosDto {
  @ApiProperty({
    description: 'Nombre del activo',
    example: 'Generador diesel 20kW',
    maxLength: 250,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Descripción del activo',
    example: 'Equipo de respaldo en sucursal norte',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

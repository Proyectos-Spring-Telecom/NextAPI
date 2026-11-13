import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearLlaveApiDto {
  @ApiProperty({
    description: 'Cliente dueño de la llave (alcance: él y sus hijos).',
    example: 15,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({
    description: 'Para qué sistema es.',
    example: 'Torre de Control Fis Fiber',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Último día de vigencia (YYYY-MM-DD). Sin él, no vence.',
    example: '2027-12-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expiraEn debe ser YYYY-MM-DD' })
  expiraEn?: string;
}

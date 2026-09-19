import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSeguimientoIncidenteDto {
  @ApiProperty({
    description: 'Acción realizada',
    example: 'Se realiza llamada a recepción',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  actividad!: string;

  @ApiPropertyOptional({
    description: 'Canal de la acción',
    example: 'Llamada',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  medio?: string;

  @ApiPropertyOptional({
    description:
      'Hora de la actividad (hora de pared). Si se omite, usa CURRENT_TIMESTAMP.',
    example: '2026-09-18 22:13:00',
  })
  @IsOptional()
  @IsString()
  fechaHora?: string;
}

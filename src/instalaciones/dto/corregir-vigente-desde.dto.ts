import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CorregirVigenteDesdeDto {
  @ApiProperty({
    description:
      'Fecha real de instalación, hora de México (`YYYY-MM-DD HH:mm:ss` o `YYYY-MM-DDTHH:mm:ss`). ' +
      'Solo hacia atrás y sin traslaparse con otro periodo del mismo dispositivo o SIM.',
    example: '2026-10-04 05:43:00',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/, {
    message: 'vigenteDesde debe tener el formato YYYY-MM-DD HH:mm:ss (hora de México).',
  })
  vigenteDesde: string;

  @ApiProperty({
    description: 'Por qué se corrige (p. ej. "fecha del CRM", "primera posición del equipo").',
    example: 'El equipo ya transmitía desde la instalación física; alta en Next posterior.',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio.' })
  @MaxLength(500)
  motivo: string;
}

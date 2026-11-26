import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CorregirNumeroSerieDto {
  @ApiProperty({ description: 'Número de serie correcto.', example: '863269078504617' })
  @IsString()
  @IsNotEmpty({ message: 'El número de serie es obligatorio.' })
  @MaxLength(100)
  numeroSerie: string;

  @ApiProperty({ description: 'Por qué se corrige (mínimo 10 caracteres).', example: 'Se capturó mal en el alta' })
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres.' })
  @MaxLength(500)
  motivo: string;
}

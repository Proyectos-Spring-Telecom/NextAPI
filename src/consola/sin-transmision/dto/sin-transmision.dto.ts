import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SIN_TRANSMISION_MAX_DIAS } from '../sin-transmision.helpers';

/** Body de `POST /consola/sin-transmision`. */
export class SinTransmisionDto {
  @ApiProperty({
    description:
      'Días sin transmitir (1..365). Se listan las unidades cuya última transmisión ' +
      'es anterior a (ahora − días), o que nunca han transmitido.',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SIN_TRANSMISION_MAX_DIAS)
  dias!: number;

  @ApiPropertyOptional({
    description:
      'Cliente opcional para acotar la lista. Debe estar en el alcance del token (403 si no). ' +
      'Se omite → todas las unidades del alcance.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;
}

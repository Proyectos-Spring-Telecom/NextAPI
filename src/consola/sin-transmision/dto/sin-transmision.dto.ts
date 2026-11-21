import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { SIN_TRANSMISION_MAX_DIAS, SIN_TRANSMISION_MAX_HORAS } from '../sin-transmision.helpers';

/** Body de `POST /consola/sin-transmision`. */
export class SinTransmisionDto {
  @ApiPropertyOptional({
    description:
      'Días sin transmitir (1..365). Se listan las unidades cuya última transmisión ' +
      'es anterior a (ahora − días), o que nunca han transmitido. Obligatorio si no viene `horas`.',
    example: 1,
  })
  @ValidateIf((o: SinTransmisionDto) => o.horas == null)
  @Type(() => Number)
  @IsInt({ message: 'Indica dias (1..365) u horas (1..8760)' })
  @Min(1)
  @Max(SIN_TRANSMISION_MAX_DIAS)
  dias?: number;

  @ApiPropertyOptional({
    description:
      'Horas sin transmitir (1..8760), para revisar el día en curso. Si viene, tiene ' +
      'prioridad sobre `dias`. Ejemplo: `horas: 2` → unidades sin transmitir en las últimas 2 horas.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SIN_TRANSMISION_MAX_HORAS)
  horas?: number;

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

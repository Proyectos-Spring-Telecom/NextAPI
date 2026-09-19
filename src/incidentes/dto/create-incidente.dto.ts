import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoOrigenIncidente } from 'src/common/estatus.enum';

export class CreateIncidenteDto {
  @ApiProperty({
    enum: TipoOrigenIncidente,
    example: TipoOrigenIncidente.POSICION,
    description: '1 = posición GPS, 2 = evento de panel',
  })
  @Type(() => Number)
  @IsEnum(TipoOrigenIncidente)
  tipoOrigen!: TipoOrigenIncidente;

  @ApiPropertyOptional({
    example: 2356,
    description: 'Obligatorio si `tipoOrigen = 1`. No enviar si `tipoOrigen = 2`.',
  })
  @ValidateIf(
    (o: CreateIncidenteDto) =>
      Number(o.tipoOrigen) === TipoOrigenIncidente.POSICION,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPosicion?: number;

  @ApiPropertyOptional({
    example: 3032,
    description: 'Obligatorio si `tipoOrigen = 2`. No enviar si `tipoOrigen = 1`.',
  })
  @ValidateIf(
    (o: CreateIncidenteDto) =>
      Number(o.tipoOrigen) === TipoOrigenIncidente.EVENTO_ALARMA,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idEventoAlarma?: number;

  @ApiPropertyOptional({
    description: 'Nota del monitorista',
    example: 'Help Me',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';

export class AsignarUsuarioInstalacionesDto {
  @ApiProperty({
    description: 'ID del usuario al que se asignan las instalaciones',
    example: 42,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  idUsuario: number;

  @ApiProperty({
    description:
      'Lista definitiva de instalaciones activas a asignar. Enviar [] para desactivar todas.',
    example: [1, 4, 6],
    type: Number,
    isArray: true,
  })
  @IsArray()
  @IsNumber({}, { each: true })
  instalacionesIds: number[];
}

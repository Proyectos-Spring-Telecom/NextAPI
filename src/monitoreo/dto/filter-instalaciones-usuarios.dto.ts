import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class FilterInstalacionesUsuariosMonitoreoDto {
  @ApiProperty({
    description: 'ID del cliente dueño de las instalaciones',
    example: 1,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({
    description:
      'IDs de usuarios. Se unen las instalaciones activas asignadas en UsuariosInstalaciones.',
    example: [5, 12, 18],
    type: Number,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  idUsuarios!: number[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class UpdateInmueblesEstatusDto {
  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1 })
  @IsInt()
  @IsIn([0, 1])
  estatus: number;
}

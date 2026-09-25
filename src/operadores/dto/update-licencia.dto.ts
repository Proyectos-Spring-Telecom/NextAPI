import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { CreateLicenciaDto } from './create-licencia.dto';

export class UpdateLicenciaDto extends PartialType(CreateLicenciaDto) {
  @ApiPropertyOptional({
    description: 'Estatus (1 activo, 0 inactivo). Preferible PATCH estatus.',
    enum: [0, 1],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  estatus?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { EstatusEnum } from '../estatus.enum';

export class ObtenerTodosQueryDto {
  @ApiPropertyOptional({
    name: 'obtenerTodos',
    enum: EstatusEnum,
    description:
      'Opcional. `0` (`EstatusEnum.INACTIVO`) u omitido: excluye INSERVIBLE. ' +
      '`1` (`EstatusEnum.ACTIVO`): incluye todos los estatus.',
    example: EstatusEnum.INACTIVO,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(EstatusEnum)
  obtenerTodos?: EstatusEnum;
}

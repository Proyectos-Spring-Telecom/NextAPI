import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { EstatusEnum } from '../estatus.enum';

export const OBTENER_TODOS_API_QUERY = {
  name: 'obtenerTodos',
  required: false,
  enum: EstatusEnum,
  description:
    'Opcional. `0` (`EstatusEnum.INACTIVO`) u omitido: excluye INSERVIBLE. ' +
    '`1` (`EstatusEnum.ACTIVO`): incluye todos los estatus.',
} as const;

export class ObtenerTodosQueryDto {
  @ApiPropertyOptional({
    name: 'obtenerTodos',
    enum: EstatusEnum,
    description: OBTENER_TODOS_API_QUERY.description,
    example: EstatusEnum.INACTIVO,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(EstatusEnum)
  obtenerTodos?: EstatusEnum;
}

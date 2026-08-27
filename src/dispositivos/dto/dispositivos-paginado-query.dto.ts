import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ObtenerTodosQueryDto } from 'src/common/dto/obtener-todos-query.dto';

export class DispositivosPaginadoQueryDto extends ObtenerTodosQueryDto {
  @ApiPropertyOptional({
    type: Number,
    description: 'Filtrar por CatTipoDispositivo.Id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idTipoDispositivo?: number;
}

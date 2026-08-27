import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { ObtenerTodosQueryDto } from 'src/common/dto/obtener-todos-query.dto';
import { EnumTipoProducto } from 'src/common/estatus.enum';

export class ProductosPaginadoQueryDto extends ObtenerTodosQueryDto {
  @ApiPropertyOptional({
    enum: EnumTipoProducto,
    description: 'Filtrar por CatTipoProducto.Id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsEnum(EnumTipoProducto)
  idTipoProducto?: EnumTipoProducto;
}

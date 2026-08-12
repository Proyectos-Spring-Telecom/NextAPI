import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { EstatusEnum } from 'src/common/estatus.enum';
import { CreateCatPlanesTelefoniaDto } from './create-cat-planes-telefonia.dto';

export class UpdateCatPlanesTelefoniaDto extends PartialType(
  CreateCatPlanesTelefoniaDto,
) {
  @ApiPropertyOptional({
    description: 'Estatus del registro',
    enum: EstatusEnum,
    enumName: 'EstatusEnum',
    example: EstatusEnum.ACTIVO,
  })
  @Type(() => Number)
  @IsOptional()
  @IsEnum(EstatusEnum)
  estatus?: EstatusEnum;
}

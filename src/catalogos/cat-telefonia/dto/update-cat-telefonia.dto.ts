import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { EstatusEnum } from 'src/common/estatus.enum';
import { CreateCatTelefoniaDto } from './create-cat-telefonia.dto';

export class UpdateCatTelefoniaDto extends PartialType(CreateCatTelefoniaDto) {
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

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';
import { EstatusEnum } from 'src/common/estatus.enum';

export class UpdateDispositivoEstatusDto {
  @ApiProperty({
    description: 'Estatus destino: 1 = activo, 0 = inactivo',
    enum: [EstatusEnum.INACTIVO, EstatusEnum.ACTIVO],
    example: EstatusEnum.INACTIVO,
  })
  @IsInt()
  @IsNotEmpty()
  @IsIn([EstatusEnum.INACTIVO, EstatusEnum.ACTIVO], {
    message: 'estatus debe ser 0 (inactivo) o 1 (activo)',
  })
  estatus!: number;
}

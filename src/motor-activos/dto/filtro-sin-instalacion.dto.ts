import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';

export class FiltroSinInstalacionDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/, {
    message: 'desde debe tener el formato YYYY-MM-DD o YYYY-MM-DD HH:mm:ss (hora de México).',
  })
  desde?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 3, 4, 5], { message: 'estatus debe ser 0, 1, 3, 4 o 5 (un equipo en 2 está instalado).' })
  estatus?: number;
}

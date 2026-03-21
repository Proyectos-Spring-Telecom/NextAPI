import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoVehiculoDto } from './create-cat-tipo-vehiculo.dto';

export class UpdateCatTipoVehiculoDto extends PartialType(
  CreateCatTipoVehiculoDto,
) {}

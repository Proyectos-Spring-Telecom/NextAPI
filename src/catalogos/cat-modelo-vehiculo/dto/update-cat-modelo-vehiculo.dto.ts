import { PartialType } from '@nestjs/mapped-types';
import { CreateCatModeloVehiculoDto } from './create-cat-modelo-vehiculo.dto';

export class UpdateCatModeloVehiculoDto extends PartialType(
  CreateCatModeloVehiculoDto,
) {}

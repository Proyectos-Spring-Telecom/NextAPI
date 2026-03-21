import { PartialType } from '@nestjs/mapped-types';
import { CreateCatMarcaVehiculoDto } from './create-cat-marca-vehiculo.dto';

export class UpdateCatMarcaVehiculoDto extends PartialType(
  CreateCatMarcaVehiculoDto,
) {}

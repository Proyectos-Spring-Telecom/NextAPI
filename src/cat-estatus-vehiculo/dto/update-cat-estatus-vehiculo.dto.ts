import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusVehiculoDto } from './create-cat-estatus-vehiculo.dto';

export class UpdateCatEstatusVehiculoDto extends PartialType(
  CreateCatEstatusVehiculoDto,
) {}

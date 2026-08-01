import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVehiculosDto } from './create-vehiculos.dto';

export class UpdateVehiculosDto extends PartialType(
  OmitType(CreateVehiculosDto, ['idProducto'] as const),
) {}

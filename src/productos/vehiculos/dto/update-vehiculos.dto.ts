import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVehiculosDto } from './create-vehiculos.dto';

export class UpdateVehiculosDto extends PartialType(
  OmitType(CreateVehiculosDto, ['idCliente'] as const),
) {}

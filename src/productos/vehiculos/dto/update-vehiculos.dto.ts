import { PartialType } from '@nestjs/swagger';
import { CreateVehiculosDto } from './create-vehiculos.dto';

export class UpdateVehiculosDto extends PartialType(CreateVehiculosDto) {}

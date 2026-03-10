import { PartialType } from '@nestjs/mapped-types';
import { CreateVehiculosDto } from './create-vehiculos.dto';

export class UpdateVehiculosDto extends PartialType(CreateVehiculosDto) {}

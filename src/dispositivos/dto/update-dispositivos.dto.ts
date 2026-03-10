import { PartialType } from '@nestjs/mapped-types';
import { CreateDispositivosDto } from './create-dispositivos.dto';

export class UpdateDispositivosDto extends PartialType(CreateDispositivosDto) {}

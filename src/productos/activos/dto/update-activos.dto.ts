import { PartialType } from '@nestjs/swagger';
import { CreateActivosDto } from './create-activos.dto';

export class UpdateActivosDto extends PartialType(CreateActivosDto) {}

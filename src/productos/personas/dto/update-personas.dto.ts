import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePersonasDto } from './create-personas.dto';

export class UpdatePersonasDto extends PartialType(
  OmitType(CreatePersonasDto, ['idCliente'] as const),
) {}

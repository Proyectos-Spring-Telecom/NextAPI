import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRelojDto } from './create-reloj.dto';

export class UpdateRelojDto extends PartialType(
  OmitType(CreateRelojDto, ['idCliente'] as const),
) {}

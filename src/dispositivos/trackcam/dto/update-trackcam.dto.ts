import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTrackcamDto } from './create-trackcam.dto';

export class UpdateTrackcamDto extends PartialType(
  OmitType(CreateTrackcamDto, ['idCliente'] as const),
) {}

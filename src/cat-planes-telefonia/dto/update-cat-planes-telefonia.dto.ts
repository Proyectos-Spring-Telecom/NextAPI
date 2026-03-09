import { PartialType } from '@nestjs/mapped-types';
import { CreateCatPlanesTelefoniaDto } from './create-cat-planes-telefonia.dto';

export class UpdateCatPlanesTelefoniaDto extends PartialType(
  CreateCatPlanesTelefoniaDto,
) {}

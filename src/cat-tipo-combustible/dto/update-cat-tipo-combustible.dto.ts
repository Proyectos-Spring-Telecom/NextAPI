import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoCombustibleDto } from './create-cat-tipo-combustible.dto';

export class UpdateCatTipoCombustibleDto extends PartialType(
  CreateCatTipoCombustibleDto,
) {}

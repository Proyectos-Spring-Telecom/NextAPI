import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoGeocercaDto } from './create-cat-tipo-geocerca.dto';

export class UpdateCatTipoGeocercaDto extends PartialType(
  CreateCatTipoGeocercaDto,
) {}

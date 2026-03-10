import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoDispositivoDto } from './create-cat-tipo-dispositivo.dto';

export class UpdateCatTipoDispositivoDto extends PartialType(
  CreateCatTipoDispositivoDto,
) {}

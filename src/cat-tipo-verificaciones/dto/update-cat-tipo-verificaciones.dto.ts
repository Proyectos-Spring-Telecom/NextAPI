import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoVerificacionesDto } from './create-cat-tipo-verificaciones.dto';

export class UpdateCatTipoVerificacionesDto extends PartialType(
  CreateCatTipoVerificacionesDto,
) {}

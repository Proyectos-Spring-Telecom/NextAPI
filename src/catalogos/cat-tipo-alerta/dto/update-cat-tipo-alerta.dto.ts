import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoAlertaDto } from './create-cat-tipo-alerta.dto';

export class UpdateCatTipoAlertaDto extends PartialType(
  CreateCatTipoAlertaDto,
) {}

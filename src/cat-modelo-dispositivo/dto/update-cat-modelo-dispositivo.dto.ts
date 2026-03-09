import { PartialType } from '@nestjs/mapped-types';
import { CreateCatModeloDispositivoDto } from './create-cat-modelo-dispositivo.dto';

export class UpdateCatModeloDispositivoDto extends PartialType(
  CreateCatModeloDispositivoDto,
) {}

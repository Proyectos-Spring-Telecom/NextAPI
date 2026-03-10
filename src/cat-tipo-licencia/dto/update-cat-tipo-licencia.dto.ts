import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTipoLicenciaDto } from './create-cat-tipo-licencia.dto';

export class UpdateCatTipoLicenciaDto extends PartialType(
  CreateCatTipoLicenciaDto,
) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateCatCategoriaLicenciaDto } from './create-cat-categoria-licencia.dto';

export class UpdateCatCategoriaLicenciaDto extends PartialType(
  CreateCatCategoriaLicenciaDto,
) {}

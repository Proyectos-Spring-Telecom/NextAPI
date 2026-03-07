import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusOperadorDto } from './create-cat-estatus-operador.dto';

export class UpdateCatEstatusOperadorDto extends PartialType(
  CreateCatEstatusOperadorDto,
) {}

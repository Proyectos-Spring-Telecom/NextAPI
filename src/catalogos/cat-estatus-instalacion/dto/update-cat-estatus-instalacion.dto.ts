import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusInstalacionDto } from './create-cat-estatus-instalacion.dto';

export class UpdateCatEstatusInstalacionDto extends PartialType(
  CreateCatEstatusInstalacionDto,
) {}

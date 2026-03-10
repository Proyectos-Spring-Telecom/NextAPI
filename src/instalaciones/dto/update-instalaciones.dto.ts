import { PartialType } from '@nestjs/mapped-types';
import { CreateInstalacionesDto } from './create-instalaciones.dto';

export class UpdateInstalacionesDto extends PartialType(
  CreateInstalacionesDto,
) {}

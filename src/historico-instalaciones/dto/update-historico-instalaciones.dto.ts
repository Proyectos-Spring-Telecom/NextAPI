import { PartialType } from '@nestjs/mapped-types';
import { CreateHistoricoInstalacionesDto } from './create-historico-instalaciones.dto';

export class UpdateHistoricoInstalacionesDto extends PartialType(
  CreateHistoricoInstalacionesDto,
) {}

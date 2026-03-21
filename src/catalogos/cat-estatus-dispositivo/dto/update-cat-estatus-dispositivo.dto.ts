import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusDispositivoDto } from './create-cat-estatus-dispositivo.dto';

export class UpdateCatEstatusDispositivoDto extends PartialType(
  CreateCatEstatusDispositivoDto,
) {}

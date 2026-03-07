import { PartialType } from '@nestjs/mapped-types';
import { CreateCatMarcaDispositivoDto } from './create-cat-marca-dispositivo.dto';

export class UpdateCatMarcaDispositivoDto extends PartialType(
  CreateCatMarcaDispositivoDto,
) {}

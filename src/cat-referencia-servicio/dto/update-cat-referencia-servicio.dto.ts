import { PartialType } from '@nestjs/mapped-types';
import { CreateCatReferenciaServicioDto } from './create-cat-referencia-servicio.dto';

export class UpdateCatReferenciaServicioDto extends PartialType(
  CreateCatReferenciaServicioDto,
) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateCatEstatusSimDto } from './create-cat-estatus-sim.dto';

export class UpdateCatEstatusSimDto extends PartialType(
  CreateCatEstatusSimDto,
) {}

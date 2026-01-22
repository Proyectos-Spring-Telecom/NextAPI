import { PartialType } from '@nestjs/mapped-types';
import { CreateModuloDto } from './create-modulo.dto';
export class UpdateModuloDto extends PartialType(CreateModuloDto) {}

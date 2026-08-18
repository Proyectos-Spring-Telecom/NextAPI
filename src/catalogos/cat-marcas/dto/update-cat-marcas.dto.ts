import { PartialType } from '@nestjs/swagger';
import { CreateCatMarcasDto } from './create-cat-marcas.dto';

export class UpdateCatMarcasDto extends PartialType(CreateCatMarcasDto) {}

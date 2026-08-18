import { PartialType } from '@nestjs/swagger';
import { CreateCatModelosDto } from './create-cat-modelos.dto';

export class UpdateCatModelosDto extends PartialType(CreateCatModelosDto) {}

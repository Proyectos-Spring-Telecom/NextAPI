import { PartialType } from '@nestjs/mapped-types';
import { CreateCatTelefoniaDto } from './create-cat-telefonia.dto';

export class UpdateCatTelefoniaDto extends PartialType(CreateCatTelefoniaDto) {}

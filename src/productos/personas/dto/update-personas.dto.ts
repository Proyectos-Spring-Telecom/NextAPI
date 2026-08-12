import { PartialType } from '@nestjs/swagger';
import { CreatePersonasDto } from './create-personas.dto';

export class UpdatePersonasDto extends PartialType(CreatePersonasDto) {}

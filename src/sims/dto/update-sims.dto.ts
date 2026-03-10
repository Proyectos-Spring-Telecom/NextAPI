import { PartialType } from '@nestjs/mapped-types';
import { CreateSimsDto } from './create-sims.dto';

export class UpdateSimsDto extends PartialType(CreateSimsDto) {}

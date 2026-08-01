import { PartialType } from '@nestjs/swagger';
import { CreateSimsDto } from './create-sims.dto';

export class UpdateSimsDto extends PartialType(CreateSimsDto) {}

import { PartialType } from '@nestjs/swagger';
import { CreateInmueblesDto } from './create-inmuebles.dto';

export class UpdateInmueblesDto extends PartialType(CreateInmueblesDto) {}

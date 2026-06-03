import { PartialType } from '@nestjs/mapped-types';
import { CreateInmueblesDto } from './create-inmuebles.dto';

export class UpdateInmueblesDto extends PartialType(CreateInmueblesDto) {}

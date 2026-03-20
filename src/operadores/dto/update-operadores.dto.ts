import { PartialType } from '@nestjs/mapped-types';
import { CreateOperadoresDto } from './create-operadores.dto';

export class UpdateOperadoresDto extends PartialType(CreateOperadoresDto) {}

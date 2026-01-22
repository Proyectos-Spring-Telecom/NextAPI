import { PartialType } from '@nestjs/mapped-types';
import { CreatePermisoDto } from './create-permiso.dto';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdatePermisoDto extends PartialType(CreatePermisoDto) {}


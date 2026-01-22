import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreatePermisoDto {
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({
    description: 'Nombre del permiso',
    example: 'Permiso',
  })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @ApiProperty({
    description: 'Descripción del permiso',
    example: 'Permiso',
  })
  descripcion?: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Numero del modulo',
    example: '1',
  })
  idModulo: number;

  @IsOptional()
  @IsInt({ message: 'Estatus debe ser 0 ó 1' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({ description: 'Estatus del cliente', example: 1 })
  estatus?: number = 1;
}

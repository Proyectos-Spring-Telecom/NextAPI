import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInmueblesDto {
  @ApiProperty({ description: 'Nombre del inmueble', maxLength: 400, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  inmueble?: string;

  @ApiProperty({ description: 'Dirección fiscal', required: false })
  @IsOptional()
  @IsString()
  direccionFiscal?: string;

  @ApiProperty({ description: 'Nombre del representante', maxLength: 250, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nombreRepresentante?: string;

  @ApiProperty({ description: 'Teléfono del representante', maxLength: 10, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  telefonoRepresentante?: string;

  @ApiProperty({ description: 'Correo del representante', maxLength: 100, required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  correoRepresentante?: string;

  @ApiProperty({ description: 'Latitud', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiProperty({ description: 'Longitud', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
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

  @ApiProperty({ description: 'Vigencia en años', maxLength: 45, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  vigenciaAnios?: string;

  @ApiProperty({ description: 'Fecha inicio vigencia', required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiProperty({ description: 'Fecha fin vigencia', required: false })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

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

  @ApiProperty({ description: 'Datos del mapa (JSON)', required: false })
  @IsOptional()
  @IsObject()
  mapaInmueble?: Record<string, unknown>;

  @ApiProperty({ description: 'Estatus (1 activo, 0 inactivo)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}

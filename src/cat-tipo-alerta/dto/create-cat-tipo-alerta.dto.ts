import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCatTipoAlertaDto {
  @ApiProperty({
    description: 'Nombre del tipo de alerta',
    example: 'Exceso de velocidad',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del tipo de alerta',
    example:
      'Se activa cuando el vehículo supera el límite de velocidad configurado',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    description: 'Nombre o ruta del ícono para la UI',
    example: 'speed',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icono?: string;

  @ApiProperty({
    description: 'Severidad (1=Info, 2=Advertencia, 3=Crítica)',
    example: 2,
    required: false,
    enum: [1, 2, 3],
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  severidad?: number = 1;

  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}

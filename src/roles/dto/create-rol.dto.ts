import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  IsIn,
} from 'class-validator';

export class CreateRolDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @ApiProperty({
    description: 'Nombre del rol',
    example: 'Administrador',
  })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'La descripción no puede exceder 255 caracteres' })
  @ApiProperty({
    description: 'Descripción del rol',
    example: 'Rol con permisos administrativos completos',
    required: false,
  })
  descripcion?: string;

  @IsOptional()
  @IsInt({ message: 'Estatus debe ser 0 ó 1' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({ description: 'Estatus del cliente', example: 1 })
  estatus?: number = 1;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Nombre del módulo',
    example: 'Módulos',
  })
  nombre: string;
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Descripción del módulo',
    example: 'Módulo',
  })
  descripcion: string;
  @IsInt({ message: 'Estatus debe ser un numero entero' })
  @IsIn([0, 1], { message: 'Estatus solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'Estatus del dispositivo solo es 1 ó 0',
    example: '1',
  })
  estatus?: number = 1;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, MaxLength } from 'class-validator';

export class CreateBitacoraDto {
  @ApiProperty({
    description: 'Nombre del módulo',
    example: 'Usuarios',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modulo?: string;

  @ApiProperty({
    description: 'Descripción de la acción realizada',
    example: 'El usuario actualizó su contraseña',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcion?: string;

  @ApiProperty({
    description: 'Acción realizada en el sistema',
    example: 'UPDATE',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  accion?: string;

  @ApiProperty({
    description: 'Query SQL ejecutada o detalle técnico',
    example: 'UPDATE Usuarios SET PasswordHash = "****" WHERE Id=1',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  query?: string;

  @ApiProperty({
    description: 'Se describe el estatus del servicio',
    example: 'succes | error',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  estatus?: string;

  @ApiProperty({
    description: 'Descripcion del error',
    example: 'error insert ik usuario no valid...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;

  @ApiProperty({
    description: 'ID del usuario que generó la acción',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  idUsuario: number;

  @ApiProperty({
    description: 'ID del módulo asociado a la acción',
    example: 3,
  })
  @IsNotEmpty()
  @IsNumber()
  idModulo: number;
}

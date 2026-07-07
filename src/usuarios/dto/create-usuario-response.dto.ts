import { ApiProperty } from '@nestjs/swagger';

export class CreateUsuarioDataDto {
  @ApiProperty({
    description: 'ID del usuario recién creado',
    example: 42,
  })
  id: number;

  @ApiProperty({
    description: 'Nombre completo (nombre + apellido paterno)',
    example: 'María García',
  })
  nombre: string;
}

export class CreateUsuarioResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Usuario creado correctamente' })
  message: string;

  @ApiProperty({ type: CreateUsuarioDataDto })
  data: CreateUsuarioDataDto;
}

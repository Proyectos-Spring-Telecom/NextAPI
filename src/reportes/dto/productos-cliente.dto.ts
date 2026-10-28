import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Body de `POST /reportes/productos-cliente`. */
export class ProductosClienteDto {
  @ApiProperty({
    description:
      'Cliente a consultar. Debe estar en el alcance del rol del token.',
    example: 15,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiPropertyOptional({
    description:
      'Usuario del cliente: solo productos asignados a él ' +
      '(`UsuariosInstalaciones`, también para paneles). ' +
      'Se omite → todos los productos del cliente.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUsuario?: number;
}

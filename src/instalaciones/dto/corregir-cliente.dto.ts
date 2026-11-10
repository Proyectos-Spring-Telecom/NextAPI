import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CorregirClienteInstalacionDto {
  @ApiProperty({ description: 'Cliente correcto.', example: 22 })
  @IsInt()
  @Min(1)
  idCliente: number;

  @ApiPropertyOptional({
    description:
      'Producto del cliente correcto, disponible (1). Sin él, se copia el producto actual a ese cliente ' +
      '(un vehículo con la misma placa en el destino se reutiliza).',
    example: 1000210,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  idProducto?: number;

  @ApiProperty({ description: 'Por qué se corrige (error de captura).', example: 'Se capturó en el cliente equivocado' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio.' })
  @MaxLength(500)
  motivo: string;
}

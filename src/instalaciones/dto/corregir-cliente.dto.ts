import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CorregirClienteInstalacionDto {
  @ApiProperty({ description: 'Cliente correcto.', example: 22 })
  @IsInt()
  @Min(1)
  idCliente: number;

  @ApiProperty({
    description: 'Vehículo (producto) del cliente correcto, disponible (1). Se da de alta antes en ese cliente.',
    example: 1000210,
  })
  @IsInt()
  @Min(1)
  idProducto: number;

  @ApiProperty({ description: 'Por qué se corrige (error de captura).', example: 'Se capturó en el cliente equivocado' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio.' })
  @MaxLength(500)
  motivo: string;
}

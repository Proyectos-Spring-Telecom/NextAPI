import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatTelefoniaResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Telcel' })
  nombreTelefonia: string;

  @ApiProperty({ example: 'Juan Pérez', nullable: true })
  nombreAsesor: string | null;

  @ApiProperty({ example: '7771234567', nullable: true })
  numeroAsesor: string | null;

  @ApiProperty({ example: 1 })
  estatus: number;

  @ApiPropertyOptional({ example: 3 })
  cantidadPlanes?: number;
}

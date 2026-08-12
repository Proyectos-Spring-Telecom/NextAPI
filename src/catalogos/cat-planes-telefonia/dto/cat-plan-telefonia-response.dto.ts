import { ApiProperty } from '@nestjs/swagger';

export class TelefoniaBasicaResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Telcel' })
  nombreTelefonia: string;

  @ApiProperty({ example: 'Juan Pérez', nullable: true })
  nombreAsesor: string | null;

  @ApiProperty({ example: '7771234567', nullable: true })
  numeroAsesor: string | null;

  @ApiProperty({ example: 1 })
  estatus: number;
}

export class CatPlanTelefoniaResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Plan empresarial 10 GB', nullable: true })
  descripcion: string | null;

  @ApiProperty({ example: 2 })
  idTelefonia: number;

  @ApiProperty({ example: '10240', nullable: true })
  datos: string | null;

  @ApiProperty({ example: '1000', nullable: true })
  smsIncluidos: string | null;

  @ApiProperty({ example: '1000', nullable: true })
  vozIncluidos: string | null;

  @ApiProperty({ example: '499.90', nullable: true })
  costoMensual: string | null;

  @ApiProperty({ example: '2026-07-01', nullable: true })
  fechaInicioVigencia: string | null;

  @ApiProperty({ example: null, nullable: true })
  fechaFinVigencia: string | null;

  @ApiProperty({ example: 1 })
  estatus: number;

  @ApiProperty({ example: '2026-07-30T10:00:00.000Z' })
  fechaCreacion: Date;

  @ApiProperty({ example: '2026-07-30T10:00:00.000Z' })
  fechaActualizacion: Date;

  @ApiProperty({ type: TelefoniaBasicaResponseDto, nullable: true })
  telefonia: TelefoniaBasicaResponseDto | null;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class IngestEventoDto {
  @ApiProperty({ example: '1001' })
  @IsString()
  @IsNotEmpty()
  cuentaSia: string;

  @ApiProperty({ example: 'PA' })
  @IsString()
  @IsNotEmpty()
  codigoSia: string;

  @ApiProperty({ example: 'panico' })
  @IsString()
  @IsNotEmpty()
  tipoEvento: string;

  @ApiProperty({
    example: 'Pánico',
    description: 'Solo UI; no se persiste en EventoAlarma',
  })
  @IsString()
  tipoEventoEtiqueta: string;

  @ApiProperty({ example: 3, description: '1 informativo, 2 advertencia, 3 crítico' })
  @IsInt()
  @Min(1)
  @Max(3)
  severidad: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  esRestauracion: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  @Equals(false)
  esHeartbeat: boolean;

  @ApiProperty({ nullable: true, example: 2 })
  @IsOptional()
  @IsInt()
  zona: number | null;

  @ApiProperty({ nullable: true, example: null })
  @IsOptional()
  @IsInt()
  codigoUsuario: number | null;

  @ApiProperty({ nullable: true, example: 'Cocina' })
  @IsOptional()
  @IsString()
  nombreDispositivo: string | null;

  @ApiProperty({ nullable: true, example: null })
  @IsOptional()
  @IsInt()
  particion: number | null;

  @ApiProperty({ example: '0001' })
  @IsString()
  @IsNotEmpty()
  seq: string;

  @ApiProperty({ example: '2026-08-18T22:00:00.000Z' })
  @IsISO8601()
  recibidoEn: string;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  timestampPanel: string | null;

  @ApiProperty({ nullable: true, example: '192.168.1.50' })
  @IsOptional()
  @IsString()
  ipOrigen: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  frameCrudo: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  dataDescifrada: string | null;

  @ApiProperty({
    nullable: true,
    example: 1000001,
    description: 'PanelAlarma.IdDispositivo = EventoAlarma.IdPanel',
  })
  @IsOptional()
  @IsInt()
  idDispositivo: number | null;

  @ApiProperty({ nullable: true, example: 13 })
  @IsOptional()
  @IsInt()
  idCliente: number | null;

  @ApiProperty({ example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456' })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  idempotencyKey: string;
}

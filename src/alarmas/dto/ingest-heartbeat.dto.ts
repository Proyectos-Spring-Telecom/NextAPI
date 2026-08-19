import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class IngestHeartbeatDto {
  @ApiProperty({ example: '1001' })
  @IsString()
  @IsNotEmpty()
  cuentaSia: string;

  @ApiProperty({ nullable: true, example: 1000001 })
  @IsOptional()
  @IsInt()
  idDispositivo: number | null;

  @ApiProperty({ nullable: true, example: 13 })
  @IsOptional()
  @IsInt()
  idCliente: number | null;

  @ApiProperty({ example: '2026-08-18T22:00:00.000Z' })
  @IsISO8601()
  ultimoHeartbeat: string;

  @ApiProperty({ example: '0001' })
  @IsString()
  @IsNotEmpty()
  seq: string;

  @ApiProperty({ nullable: true, example: '192.168.1.50' })
  @IsOptional()
  @IsString()
  ipOrigen: string | null;

  @ApiProperty({ example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456' })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  idempotencyKey: string;
}

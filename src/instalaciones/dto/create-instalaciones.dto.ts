import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({ description: 'ID del cliente (tenant)' })
  @IsInt()
  @IsNotEmpty()
  idCliente: number;

  @ApiProperty({ description: 'ID de producto (obligatorio)' })
  @IsInt()
  @IsNotEmpty()
  idProducto: number;

  @ApiPropertyOptional({
    description: 'ID dispositivo (mismo cliente)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idDispositivo?: number | null;

  @ApiPropertyOptional({
    description: 'ID SIM (mismo cliente)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idSim?: number | null;

  @ApiPropertyOptional({
    description: 'Observaciones del alta',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}

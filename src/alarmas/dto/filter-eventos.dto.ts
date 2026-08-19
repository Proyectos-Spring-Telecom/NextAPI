import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FilterEventosDto {
  @ApiPropertyOptional({ description: 'Filtro de tenant (según rol)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCliente?: number;

  @ApiPropertyOptional({
    description: 'EventoAlarma.IdPanel = PanelAlarma.IdDispositivo',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idPanel?: number;

  @ApiPropertyOptional({ example: 'PA' })
  @IsOptional()
  @IsString()
  codigoSia?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 sobre RecibidoEn' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 sobre RecibidoEn' })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, description: '1–100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FilterAlarmasQueryDto {
  @ApiPropertyOptional({ description: 'Filtro de tenant (según rol)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCliente?: number;
}

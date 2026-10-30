import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ESTATUS_ORDEN, ORIGEN_ORDEN, TIPOS_SERVICIO } from '../ordenes-servicio.reglas';

export class FilterOrdenesServicioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCliente?: number;

  @ApiPropertyOptional({ description: 'Vehículo/activo: historial completo de la unidad (estable entre versiones de la instalación)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idProducto?: number;

  @ApiPropertyOptional({ description: 'Instalación atendida o resultante' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idInstalacion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTecnico?: number;

  @ApiPropertyOptional({ enum: TIPOS_SERVICIO })
  @IsOptional()
  @IsIn([...TIPOS_SERVICIO])
  tipoServicio?: string;

  @ApiPropertyOptional({ enum: Object.values(ESTATUS_ORDEN) })
  @IsOptional()
  @IsIn(Object.values(ESTATUS_ORDEN))
  estatus?: string;

  @ApiPropertyOptional({ enum: Object.values(ORIGEN_ORDEN), description: 'Quién programó la orden' })
  @IsOptional()
  @IsIn(Object.values(ORIGEN_ORDEN))
  origen?: string;

  @ApiPropertyOptional({ description: 'Referencia de la orden en el CRM' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenciaCrm?: string;
}

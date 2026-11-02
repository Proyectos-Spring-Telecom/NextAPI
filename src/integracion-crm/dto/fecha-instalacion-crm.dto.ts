import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class FechaInstalacionCrmDto {
  @ApiProperty({ description: 'Cliente de Next al que pertenece la instalación (el CRM solo corrige las de su cliente)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idClienteNext: number;

  @ApiProperty({ example: '2021-03-12', description: 'Día real de instalación (hora de México); se guarda a las 00:00' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener el formato YYYY-MM-DD' })
  fecha: string;

  @ApiProperty({ example: 'Fecha del contrato en el CRM' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio.' })
  @MaxLength(400)
  motivo: string;

  @ApiPropertyOptional({ description: 'Usuario del CRM que la corrige (va en el motivo)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  usuario?: string;
}

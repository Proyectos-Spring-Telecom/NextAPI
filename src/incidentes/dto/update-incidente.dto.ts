import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateIncidenteDto {
  @ApiPropertyOptional({
    description: 'Nota del monitorista. No cambia origen ni snapshot.',
    example: 'Se confirma pánico en unidad Eco 12',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}

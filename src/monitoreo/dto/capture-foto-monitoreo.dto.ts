import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CaptureFotoMonitoreoDto {
  @ApiPropertyOptional({
    description:
      'Canal 1–4. Si se omite, el gateway usa todos los canales activos del registry (máx. 4).',
    minimum: 1,
    maximum: 4,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  channelId?: number;
}

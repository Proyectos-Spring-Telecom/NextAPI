import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CaptureFotoMonitoreoDto {
  @ApiPropertyOptional({
    description:
      'Canal 1–5. Si se omite, el gateway usa todos los canales activos del registry (máx. 3).',
    minimum: 1,
    maximum: 5,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  channelId?: number;
}

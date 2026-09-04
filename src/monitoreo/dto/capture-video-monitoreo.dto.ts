import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CaptureVideoMonitoreoDto {
  @ApiPropertyOptional({
    description: 'Duración del clip en segundos (máx. 30)',
    default: 30,
    minimum: 1,
    maximum: 30,
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Canal 1–5. Si se omite, el gateway captura en paralelo todos los canales activos (máx. 3).',
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

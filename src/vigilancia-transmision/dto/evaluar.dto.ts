import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class EvaluarTransmisionDto {
  @ApiPropertyOptional({ description: 'Repite la evaluación aunque ya se haya hecho hoy.', default: false })
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}

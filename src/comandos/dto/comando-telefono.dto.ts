import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ComandoTelefonoDto {
  @ApiProperty({ enum: ['INTERVALO', 'UBICAR', 'ESTADO', 'SMS'], example: 'UBICAR' })
  @IsIn(['INTERVALO', 'UBICAR', 'ESTADO', 'SMS'])
  tipo: 'INTERVALO' | 'UBICAR' | 'ESTADO' | 'SMS';

  @ApiPropertyOptional({ description: 'INTERVALO: segundos entre reportes (30–3600)', example: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  intervaloSeg?: number;

  @ApiPropertyOptional({ description: 'SMS: PIN de 4 a 8 dígitos para los comandos por SMS', example: '482913' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/)
  pin?: string;

  @ApiPropertyOptional({ description: 'SMS: hasta 5 números autorizados para mandar comandos por SMS', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  numeros?: string[];
}

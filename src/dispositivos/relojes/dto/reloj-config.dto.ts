import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const FLAG = [0, 1] as const;

export class RelojConfigDto {
  @ApiPropertyOptional({
    description: 'UPLOAD: cada cuántos segundos reporta posición en movimiento (mín. 60)',
    default: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  intervaloReporteSegundos?: number | null;

  @ApiPropertyOptional({
    description:
      'Cada cuántos segundos el servidor enciende el GPS (CR). 0 = solo al llegar SOS o caída. ' +
      'El reloj no lo enciende por su cuenta; cada encendido gasta batería',
    default: 600,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervaloGpsSegundos?: number | null;

  @ApiPropertyOptional({ description: 'Detección de caída activa (0/1)', enum: FLAG, default: 1 })
  @IsOptional()
  @IsIn([...FLAG])
  deteccionCaida?: number;

  @ApiPropertyOptional({ description: 'El reloj llama al detectar caída (0/1)', enum: FLAG, default: 1 })
  @IsOptional()
  @IsIn([...FLAG])
  llamadaPorCaida?: number;

  @ApiPropertyOptional({
    description: 'Sensibilidad del sensor de caída: 1 a 6, mayor = menos sensible',
    minimum: 1,
    maximum: 6,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  sensibilidadCaida?: number;
}

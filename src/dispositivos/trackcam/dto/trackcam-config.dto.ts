import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const FLAG = [0, 1] as const;

export class TrackcamConfigDto {
  @ApiPropertyOptional({
    description: 'Cada cuántos segundos reporta posición (en movimiento)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervaloPosicionSegundos?: number | null;

  @ApiPropertyOptional({
    description: 'Cada cuántos segundos reporta detenido / ACC off',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervaloPosicionDetenidoSegundos?: number | null;

  @ApiPropertyOptional({
    description: 'Cada cuántos segundos captura/envía imágenes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervaloImagenSegundos?: number | null;

  @ApiPropertyOptional({
    description:
      'Velocidad (km/h) a partir de la cual se evalúan alarmas ADAS/DSM',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  velocidadMinimaAlarmasKmh?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  canal1Activo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  canal2Activo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  canal3Activo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  canal4Activo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  canal5Activo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaFatiga?: number;

  @ApiPropertyOptional({ description: 'Nivel DSM 1-10. Mayor = más severo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  umbralFatiga?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaTelefono?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaFumar?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaDistraccion?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaConductorAusente?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaCinturon?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaObstruccionCamara?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaColisionFrontal?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaSalidaCarril?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaDistanciaCorta?: number;

  @ApiPropertyOptional({
    description: 'Umbral de distancia al vehículo de adelante (unidad 100 ms)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  distanciaCortaSegundos?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaColisionPeaton?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaCambioCarrilFrecuente?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaExcesoSenalTransito?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaObstaculo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaFallaAdas?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaAceleracionBrusca?: number;

  @ApiPropertyOptional({ description: 'Umbral aceleración, unidad 1/100 g' })
  @IsOptional()
  @IsInt()
  umbralAceleracionG?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaFrenadoBrusco?: number;

  @ApiPropertyOptional({ description: 'Umbral desaceleración, unidad 1/100 g' })
  @IsOptional()
  @IsInt()
  umbralFrenadoG?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaGiroBrusco?: number;

  @ApiPropertyOptional({ description: 'Umbral giro, unidad 1/100 g' })
  @IsOptional()
  @IsInt()
  umbralGiroG?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaRalenti?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaApagadoAnormal?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaAproximacionTrasera?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaAproximacionTraseraIzq?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaAproximacionTraseraDer?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaExcesoVelocidad?: number;

  @ApiPropertyOptional({ description: 'Umbral de exceso de velocidad (km/h)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  velocidadMaximaKmh?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaFatigaTiempo?: number;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaColision?: number;

  @ApiPropertyOptional({ description: 'Umbral colisión, unidad 0.1 g' })
  @IsOptional()
  @IsInt()
  colisionAceleracionG?: number | null;

  @ApiPropertyOptional({ enum: FLAG, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn(FLAG)
  alarmaVolteo?: number;
}

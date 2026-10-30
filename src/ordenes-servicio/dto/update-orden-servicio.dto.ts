import { ESTATUS_SALIDA_INSTALACION } from 'src/motor-activos/estatus-recurso';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ESTATUS_BAJA_PERMITIDOS,
  SECCIONES_RESPUESTA,
} from '../ordenes-servicio.reglas';

export class RespuestaOrdenServicioDto {
  @ApiProperty({ enum: SECCIONES_RESPUESTA })
  @IsIn([...SECCIONES_RESPUESTA])
  seccion: string;

  @ApiProperty({ description: 'Clave de la opción en GET /ordenes-servicio/catalogo', example: 'inmovilizador' })
  @IsString()
  @MaxLength(40)
  clave: string;

  @ApiProperty({ description: 'true = sí / correcto; false = no' })
  @IsBoolean()
  valor: boolean;
}

/**
 * Guardado parcial: solo se cambia lo que se envía. `null` borra el valor.
 * Las respuestas se suman/reemplazan por (seccion, clave); no borran las demás.
 */
export class UpdateOrdenServicioDto {
  @ApiPropertyOptional({ description: 'Vehículo/activo (solo alta)', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsInt()
  idProducto?: number | null;

  @ApiPropertyOptional({ description: 'Alta o cambio de equipo: dispositivo que entra (estatus 1, mismo cliente)', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsInt()
  idDispositivoNuevo?: number | null;

  @ApiPropertyOptional({ description: 'Alta (opcional) o cambio de SIM: SIM que entra', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsInt()
  idSimNuevo?: number | null;

  @ApiPropertyOptional({
    description: 'Cambio de equipo/SIM: estatus que recibe el que sale: 3 por revisar, 4 laboratorio o 5 inservible (CatEstatusRecurso)',
    enum: ESTATUS_SALIDA_INSTALACION,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsIn([...ESTATUS_SALIDA_INSTALACION], {
    message: 'estatusSalienteAnterior debe ser 3 (por revisar), 4 (laboratorio) o 5 (inservible)',
  })
  estatusSalienteAnterior?: number | null;

  @ApiPropertyOptional({
    description: 'Desinstalación: 0 = inactiva, 5 = inservible',
    enum: ESTATUS_BAJA_PERMITIDOS,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsIn([...ESTATUS_BAJA_PERMITIDOS])
  estatusInstalacionBaja?: number | null;

  @ApiPropertyOptional({ description: 'Usuario con rol Jefe de monitoreo (4) o Monitorista (5)', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsInt()
  idMonitorista?: number | null;

  @ApiPropertyOptional({
    description: 'Reloj del dispositivo al registrar, ISO 8601 con zona (se guarda en hora de Ciudad de México)',
    example: '2026-10-27T20:50:00-06:00',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsISO8601({ strict: true })
  fechaCaptura?: string | null;

  @ApiPropertyOptional({ description: 'GPS del dispositivo; null si se negó el permiso', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsLatitude()
  lat?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsLongitude()
  lng?: number | null;

  @ApiPropertyOptional({ description: 'Observaciones; obligatorias si la falla "otro" está en sí', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(4000)
  observaciones?: string | null;

  @ApiPropertyOptional({ type: [RespuestaOrdenServicioDto] })
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RespuestaOrdenServicioDto)
  respuestas?: RespuestaOrdenServicioDto[];
}

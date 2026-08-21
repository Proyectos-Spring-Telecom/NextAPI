import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  EnumEstatusInstalacion,
  EnumEstatusProductoDispositivo,
  ESTATUS_INSTALACION_UPDATE_HISTORICO,
  ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
} from 'src/common/estatus.enum';

/**
 * Actualización = archivar vigente + borrar + crear nueva versión (estatus ACTIVO).
 * No usa PartialType de create: no se envía idCliente ni se cambia a baja aquí.
 */
export class UpdateInstalacionesDto {
  @ApiProperty({
    description:
      'Estatus que se guarda en `HistoricoInstalaciones` al archivar la versión ' +
      'anterior (contexto del cambio). Permitidos: 0=INACTIVO, 1=ACTIVA, ' +
      '3=BAJA_REMPLAZO, 4=BAJA_MANTENIMIENTO, 5=INSERVIBLE. ' +
      'La nueva instalación vigente se crea siempre como ACTIVA (1).',
    enum: ESTATUS_INSTALACION_UPDATE_HISTORICO,
    example: EnumEstatusInstalacion.BAJA_REMPLAZO,
  })
  @IsIn([...ESTATUS_INSTALACION_UPDATE_HISTORICO], {
    message:
      'estatusInstalacion debe ser 0 (INACTIVO), 1 (ACTIVA), 3 (BAJA_REMPLAZO), 4 (BAJA_MANTENIMIENTO) o 5 (INSERVIBLE)',
  })
  estatusInstalacion: EnumEstatusInstalacion;

  @ApiPropertyOptional({ description: 'Nuevo producto' })
  @IsOptional()
  @IsInt()
  idProducto?: number;

  @ApiPropertyOptional({
    description:
      'Estatus a aplicar al producto que sale (obligatorio en servicio si cambia idProducto). ' +
      '0=inactivo, 1=activo, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible',
    enum: ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
    example: EnumEstatusProductoDispositivo.ACTIVO,
  })
  @IsOptional()
  @IsIn([...ESTATUS_PRODUCTO_DISPOSITIVO_PATCH], {
    message:
      'estatusProductoAnterior debe ser 0, 1, 2, 3, 4 o 5',
  })
  estatusProductoAnterior?: EnumEstatusProductoDispositivo;

  @ApiPropertyOptional({
    description: 'Nuevo dispositivo (null para quitar)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idDispositivo?: number | null;

  @ApiPropertyOptional({
    description:
      'Estatus a aplicar al dispositivo que sale (obligatorio si cambia o se quita idDispositivo). ' +
      '0–5 según EnumEstatusProductoDispositivo',
    enum: ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
    example: EnumEstatusProductoDispositivo.ACTIVO,
  })
  @IsOptional()
  @IsIn([...ESTATUS_PRODUCTO_DISPOSITIVO_PATCH], {
    message:
      'estatusDispositivoAnterior debe ser 0, 1, 2, 3, 4 o 5',
  })
  estatusDispositivoAnterior?: EnumEstatusProductoDispositivo;

  @ApiPropertyOptional({
    description: 'Nuevo SIM (null para quitar)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idSim?: number | null;

  @ApiPropertyOptional({
    description:
      'Estatus a aplicar al SIM que sale (obligatorio si cambia o se quita idSim). ' +
      '0–5 según EnumEstatusProductoDispositivo',
    enum: ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
    example: EnumEstatusProductoDispositivo.ACTIVO,
  })
  @IsOptional()
  @IsIn([...ESTATUS_PRODUCTO_DISPOSITIVO_PATCH], {
    message: 'estatusSimAnterior debe ser 0, 1, 2, 3, 4 o 5',
  })
  estatusSimAnterior?: EnumEstatusProductoDispositivo;

  @ApiPropertyOptional({
    description:
      'Motivo del cambio / observaciones. Se guarda en el histórico archivado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}

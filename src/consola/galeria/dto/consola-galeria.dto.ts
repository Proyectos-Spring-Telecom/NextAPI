import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Hora de pared, misma convención que `Posiciones.FechaHora`. */
const FECHA_GALERIA_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/** Query de `GET /consola/galeria/filtros`. */
export class FiltrosGaleriaQueryDto {
  @ApiPropertyOptional({
    description:
      'Cliente a consultar. Obligatorio para roles globales (1–5, 8). ' +
      'Rol 6: si se omite se usa el del token. Roles 7 y 9: se ignora (siempre el del token).',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;
}

/** Body de `POST /consola/galeria/resumen` (y base de `POST /consola/galeria`). */
export class ResumenGaleriaDto {
  @ApiPropertyOptional({
    description:
      'Cliente a consultar. Obligatorio para roles globales (1–5, 8). ' +
      'Rol 6: si se omite se usa el del token. Roles 7 y 9: se ignora (siempre el del token).',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  @ApiPropertyOptional({
    description:
      'Usuarios del cliente (1..N): solo unidades asignadas a ellos en `UsuariosInstalaciones`. ' +
      'Se omite → todas las unidades visibles del cliente.',
    type: [Number],
    example: [5],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsUsuario?: number[];

  @ApiPropertyOptional({
    description:
      'Instalaciones (1..N) a mostrar. Deben estar dentro del alcance (cliente / usuarios). ' +
      'Se omite → todas las del alcance.',
    type: [Number],
    example: [25, 26],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  idsInstalacion?: number[];

  @ApiProperty({
    description:
      'Inicio (inclusive), hora de pared. YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO sin zona.',
    example: '2026-10-01 00:00:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_GALERIA_RE, {
    message: 'fechaInicio debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaInicio!: string;

  @ApiProperty({
    description: 'Fin (inclusive). Máximo 31 días después de fechaInicio.',
    example: '2026-10-21 23:59:59',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_GALERIA_RE, {
    message: 'fechaFinal debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal!: string;
}

/** Body de `POST /consola/galeria`: mismos filtros + paginación. */
export class ConsultaGaleriaDto extends ResumenGaleriaDto {
  @ApiPropertyOptional({ description: 'Página (1..N). Default 1.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Capturas por página (1..100). Default 24.',
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** IMEI exacto (solo dígitos) para `POST /consola/galeria/imei`. */
const IMEI_FOTOS_RE = /^\d{1,20}$/;

/** Body de `POST /consola/galeria/imei`: fotos paginadas de un equipo por IMEI. */
export class FotosImeiDto {
  @ApiProperty({
    description: 'IMEI exacto del dispositivo (solo dígitos, hasta 20). Se aplica trim.',
    example: '354442090100880',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(IMEI_FOTOS_RE, {
    message: 'imei debe tener solo dígitos (hasta 20)',
  })
  imei!: string;

  @ApiPropertyOptional({
    description:
      'Inicio (inclusive), hora de pared. YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO sin zona. ' +
      'Si se omiten ambas fechas → día 1 del mes actual 00:00:00.',
    example: '2026-10-01 00:00:00',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_GALERIA_RE, {
    message: 'fechaInicio debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({
    description:
      'Fin (inclusive). Máximo 31 días después de fechaInicio. ' +
      'Si se omiten ambas fechas → hoy 23:59:59.',
    example: '2026-10-23 23:59:59',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_GALERIA_RE, {
    message: 'fechaFinal debe ser YYYY-MM-DD, YYYY-MM-DD HH:mm:ss o ISO 8601',
  })
  fechaFinal?: string;

  @ApiPropertyOptional({ description: 'Página (1..N). Default 1.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Fotos por página (1..100). Default 20.',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

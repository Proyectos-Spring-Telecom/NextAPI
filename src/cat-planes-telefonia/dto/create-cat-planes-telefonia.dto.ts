import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCatPlanesTelefoniaDto {
  @ApiProperty({
    description: 'Nombre del plan de telefonía',
    example: 'Plan M2M 500MB',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({
    description: 'Descripción del plan',
    example: 'Plan para dispositivos IoT con 500MB mensuales',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({
    description: 'ID del operador de telefonía (CatTelefonia)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  idTelefonia: number;

  @ApiProperty({
    description: 'Datos incluidos en MB (null = ilimitado)',
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  datosMB?: number | null;

  @ApiProperty({
    description: 'SMS incluidos',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  smsIncluidos?: number = 0;

  @ApiProperty({
    description: 'Minutos de voz incluidos',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  vozMinutos?: number = 0;

  @ApiProperty({
    description: 'Tecnología de red (2G, 3G, 4G LTE, 5G, NB-IoT, LTE-M)',
    example: '4G LTE',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tecnologiaRed?: string;

  @ApiProperty({
    description: 'Access Point Name para configuración del SIM',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apn?: string;

  @ApiProperty({
    description: 'Tipo de red (M2M, IoT, Consumo)',
    example: 'M2M',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipoRed?: string = 'M2M';

  @ApiProperty({
    description: 'Costo mensual en moneda base',
    example: 99.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costoMensual?: number;

  @ApiProperty({
    description: 'Costo de activación',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costoActivacion?: number = 0;

  @ApiProperty({
    description: 'Costo por MB excedente',
    example: 0.05,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costoExcedenteMB?: number;

  @ApiProperty({
    description: 'Moneda (MXN, USD, etc.)',
    example: 'MXN',
    maxLength: 3,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string = 'MXN';

  @ApiProperty({
    description: 'Duración del ciclo en días (30, 60, 365, etc.)',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  vigenciaDias?: number = 30;

  @ApiProperty({
    description: 'Renovación automática (1 sí, 0 no)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  @Type(() => Number)
  renovacionAutomatica?: number = 1;

  @ApiProperty({
    description: 'Fecha de inicio de vigencia (YYYY-MM-DD)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  fechaInicioVigencia?: string;

  @ApiProperty({
    description: 'Fecha fin de vigencia (NULL = sin fin)',
    required: false,
  })
  @IsOptional()
  fechaFinVigencia?: string | null;

  @ApiProperty({
    description: 'Estatus (1 activo, 0 inactivo)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  estatus?: number = 1;
}

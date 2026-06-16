import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateHistoricoInstalacionesDto {
  @ApiProperty({
    description: 'ID instalación relacionada',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idInstalacion?: number | null;

  @ApiProperty({
    description: 'ID dispositivo GPS que estaba instalado',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  idDispositivo?: number | null;

  @ApiProperty({ description: 'ID vehículo donde estaba instalado' })
  @IsInt()
  @IsNotEmpty()
  idVehiculo: number;

  @ApiProperty({
    description: 'ID activo asociado (pendiente)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idActivos?: number;

  @ApiProperty({
    description: 'ID portátil asociado (pendiente)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idPortatiles?: number;

  @ApiProperty({ description: 'Estatus que tenía la instalación' })
  @IsInt()
  @IsNotEmpty()
  estatusInstalacion: number;

  @ApiProperty({
    description:
      'Ej: Instalación, Desinstalación, Cambio de Dispositivo, Cambio de Vehículo, Suspensión',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accion: string;

  @ApiProperty({
    description: 'Observaciones del técnico o motivo del cambio',
    required: false,
  })
  @IsOptional()
  @IsString()
  comentario?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSimsDto {
  @ApiPropertyOptional({
    description: 'IMEI / ICC del suscriptor en la red móvil',
    maxLength: 25,
    example: '356938035643809',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  imei?: string;

  @ApiPropertyOptional({
    description: 'Número de línea / MSISDN del SIM',
    maxLength: 20,
    example: '5512345678',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroTelefono?: string;

  @ApiProperty({
    description: 'ID del cliente/tenant propietario del SIM. Obligatorio.',
    example: 11,
  })
  @IsInt()
  @IsNotEmpty()
  idCliente!: number;

  @ApiProperty({
    description: 'ID de la compañía telefónica (CatTelefonia). Obligatorio.',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  idTelefonia!: number;

  @ApiProperty({
    description: 'ID del plan de datos (CatPlanesTelefonia). Obligatorio.',
    example: 3,
  })
  @IsInt()
  @IsNotEmpty()
  idPlanTelefonia!: number;

  @ApiPropertyOptional({
    description: 'Notas u observaciones del SIM',
    maxLength: 500,
    example: 'SIM asignada a unidad 45',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

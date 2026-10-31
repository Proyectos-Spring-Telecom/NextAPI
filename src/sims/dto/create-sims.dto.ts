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

  @ApiPropertyOptional({
    description:
      'Cliente al que se reserva la SIM. Sin él (o null) entra al almacén; solo operación da de alta en almacén. ' +
      'Al instalarse toma el cliente de la instalación.',
    example: 11,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  idCliente?: number | null;

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

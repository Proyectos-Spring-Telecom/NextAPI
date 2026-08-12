import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSimsDto {
  @ApiPropertyOptional({
    description: 'IMEI / ICC del suscriptor en la red móvil. Omitir = no modificar.',
    maxLength: 25,
    example: '356938035643809',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  imei?: string;

  @ApiPropertyOptional({
    description: 'Número de línea / MSISDN del SIM. Omitir = no modificar.',
    maxLength: 20,
    example: '5598765432',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroTelefono?: string;

  @ApiPropertyOptional({
    description: 'ID del cliente/tenant propietario. Omitir = no modificar.',
    example: 11,
  })
  @IsOptional()
  @IsInt()
  idCliente?: number;

  @ApiPropertyOptional({
    description: 'ID de la compañía telefónica (CatTelefonia). Omitir = no modificar.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  idTelefonia?: number;

  @ApiPropertyOptional({
    description: 'ID del plan de datos (CatPlanesTelefonia). Omitir = no modificar.',
    example: 4,
  })
  @IsOptional()
  @IsInt()
  idPlanTelefonia?: number;

  @ApiPropertyOptional({
    description: 'Notas u observaciones del SIM. Omitir = no modificar.',
    maxLength: 500,
    example: 'Cambio de plan',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

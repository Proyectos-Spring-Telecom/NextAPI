import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { TIPOS_SERVICIO } from '../ordenes-servicio.reglas';

export class CreateOrdenServicioDto {
  @ApiProperty({
    description:
      'UUID que genera la app al empezar la orden. Reenviar el alta con la misma clave devuelve la orden existente.',
    example: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90',
  })
  @IsUUID()
  claveApp: string;

  @ApiProperty({ enum: TIPOS_SERVICIO, description: 'Una orden = un tipo de servicio' })
  @IsIn([...TIPOS_SERVICIO])
  tipoServicio: (typeof TIPOS_SERVICIO)[number];

  @ApiProperty({ description: 'Cliente dado de alta previamente (regla: no se crea en campo)' })
  @IsInt()
  @IsNotEmpty()
  idCliente: number;

  @ApiPropertyOptional({
    description: 'Instalación vigente a atender. Obligatoria salvo en `instalacion` (alta).',
  })
  @IsOptional()
  @IsInt()
  idInstalacion?: number;

  @ApiPropertyOptional({
    description: 'Vehículo/activo del cliente. Obligatorio para cerrar un alta; en los demás tipos se toma de la instalación.',
  })
  @IsOptional()
  @IsInt()
  idProducto?: number;
}

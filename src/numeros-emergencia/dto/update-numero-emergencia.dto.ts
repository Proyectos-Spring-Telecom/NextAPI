import { PartialType } from '@nestjs/swagger';
import { CreateNumeroEmergenciaDto } from './create-numero-emergencia.dto';

/** Actualización parcial. Permite cambiar `idCliente` (con reglas de rol en servicio). */
export class UpdateNumeroEmergenciaDto extends PartialType(
  CreateNumeroEmergenciaDto,
) {}

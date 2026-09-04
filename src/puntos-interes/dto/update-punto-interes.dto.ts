import { PartialType } from '@nestjs/swagger';
import { CreatePuntoInteresDto } from './create-punto-interes.dto';

/** Actualización parcial. Permite cambiar `idCliente` (con reglas de rol en servicio). */
export class UpdatePuntoInteresDto extends PartialType(CreatePuntoInteresDto) {}

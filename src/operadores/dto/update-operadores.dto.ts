import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOperadoresDto } from './create-operadores.dto';

/**
 * Actualización parcial. Sin campos de alta de primera licencia
 * (eso es flujo de Licencias). Documentos vía URL o archivo multipart.
 */
export class UpdateOperadoresDto extends PartialType(
  OmitType(CreateOperadoresDto, [
    'numeroLicencia',
    'idTipoLicencia',
    'idCategoriaLicencia',
    'fechaExpedicion',
    'fechaVencimiento',
    'licencia',
  ] as const),
) {}

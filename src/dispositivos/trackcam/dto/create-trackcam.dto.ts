import { IntersectionType, OmitType } from '@nestjs/swagger';
import { CreateDispositivosDto } from '../../dto/create-dispositivos.dto';
import { TrackcamConfigDto } from './trackcam-config.dto';

export class CreateTrackcamDto extends IntersectionType(
  OmitType(CreateDispositivosDto, ['idTipoDispositivo'] as const),
  TrackcamConfigDto,
) {}

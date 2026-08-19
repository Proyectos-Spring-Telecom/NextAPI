import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePanelAlarmaDto } from './create-panel-alarma.dto';

export class UpdatePanelAlarmaDto extends PartialType(
  OmitType(CreatePanelAlarmaDto, ['idCliente'] as const),
) {}

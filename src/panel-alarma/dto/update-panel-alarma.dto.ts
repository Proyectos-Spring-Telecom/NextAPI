import { PartialType } from '@nestjs/mapped-types';
import { CreatePanelAlarmaDto } from './create-panel-alarma.dto';

export class UpdatePanelAlarmaDto extends PartialType(CreatePanelAlarmaDto) {}

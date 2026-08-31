import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlarmasIngestService } from '../../alarmas/alarmas-ingest.service';
import { decryptSiaAes } from '../../alarmas/sia/sia-dcs.aes';
import { PanelAlarma } from '../../entities/PanelAlarma';
import {
  mapAxproEventToIngestDto,
  mapAxproHeartbeatToIngestDto,
} from './axpro-envelope.mapper';
import {
  AxproEventPayload,
  AxproHeartbeatPayload,
  AxproTelemetryEnvelope,
} from './axpro.types';

@Injectable()
export class AxproIngestService {
  private readonly logger = new Logger(AxproIngestService.name);

  constructor(
    private readonly alarmasIngest: AlarmasIngestService,
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
  ) {}

  async handleEvent(
    envelope: AxproTelemetryEnvelope<AxproEventPayload>,
  ): Promise<void> {
    if (envelope.kind !== 'event') {
      throw new BadRequestException('kind debe ser event');
    }

    const panel = await this.buscarPanelActivo(envelope.deviceId);
    const dataDescifrada = await this.resolverDataDescifrada(
      envelope.payload,
      panel,
    );
    const dto = mapAxproEventToIngestDto(envelope, dataDescifrada);

    await this.alarmasIngest.ingestEvento(dto, dto.idempotencyKey, {
      origen: 'rabbitmq',
    });
  }

  async handleHeartbeat(
    envelope: AxproTelemetryEnvelope<AxproHeartbeatPayload>,
  ): Promise<void> {
    if (envelope.kind !== 'heartbeat') {
      throw new BadRequestException('kind debe ser heartbeat');
    }

    const dto = mapAxproHeartbeatToIngestDto(envelope);
    await this.alarmasIngest.ingestHeartbeat(dto, dto.idempotencyKey, {
      origen: 'rabbitmq',
    });
  }

  private async buscarPanelActivo(
    cuentaSia: string,
  ): Promise<PanelAlarma | null> {
    return this.panelRepo.findOne({
      where: { cuentaSia, estatus: 1 },
    });
  }

  private async resolverDataDescifrada(
    payload: AxproEventPayload,
    panel: PanelAlarma | null,
  ): Promise<string | null> {
    if (payload.dataDescifrada?.trim()) {
      return payload.dataDescifrada;
    }
    if (!payload.cifrado) {
      return null;
    }
    if (!panel?.aesKey?.trim()) {
      this.logger.warn(
        `Evento cifrado sin AesKey panel cuentaSia=${panel?.cuentaSia ?? '?'}`,
      );
      return null;
    }

    const frame = payload.frameCrudo?.trim();
    if (!frame) {
      throw new BadRequestException(
        'Evento cifrado sin frameCrudo para descifrar',
      );
    }

    const bits = Number(panel.aesBits) === 256 ? 256 : 128;
    try {
      return decryptSiaAes(frame, panel.aesKey, bits);
    } catch (error) {
      this.logger.error(
        `Error descifrando SIA cuentaSia=${panel.cuentaSia}: ${(error as Error)?.message}`,
      );
      throw new BadRequestException('No se pudo descifrar el frame SIA');
    }
  }
}

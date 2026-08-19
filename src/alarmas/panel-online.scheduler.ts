import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { AlarmasGateway } from './alarmas.gateway';
import { calcularOnline } from './alarmas-mapper';

const INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PanelOnlineScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PanelOnlineScheduler.name);
  private timer?: NodeJS.Timeout;
  private readonly estado = new Map<number, boolean>();

  constructor(
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
    private readonly gateway: AlarmasGateway,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.tick(true);
    this.timer = setInterval(() => {
      void this.tick(false);
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick(inicial: boolean) {
    try {
      const threshold = Number(
        this.config.get<number>('SIA_OFFLINE_THRESHOLD_MS') ?? 600_000,
      );
      const paneles = await this.panelRepo.find({
        where: { estatus: 1 },
        select: ['idDispositivo', 'ultimoHeartbeat'],
      });
      for (const panel of paneles) {
        const id = Number(panel.idDispositivo);
        const online = calcularOnline(panel.ultimoHeartbeat, threshold);
        const previo = this.estado.get(id);
        this.estado.set(id, online);
        if (!inicial && previo !== undefined && previo !== online) {
          this.gateway.emitEstado(id, online);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error en chequeo online/offline: ${(error as Error)?.message}`,
      );
    }
  }
}

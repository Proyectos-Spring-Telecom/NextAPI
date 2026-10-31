import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { VigilanciaTransmisionService } from './vigilancia-transmision.service';
import { dentroDeVentana } from './vigilancia-transmision.reglas';

const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Cada 10 min cierra los avisos resueltos y, dentro de 9:00–11:00 (hora de
 * México), corre la evaluación del día si nadie la ha corrido (la fila de
 * EvaluacionesTransmision lo garantiza aunque haya reinicios o varias instancias).
 * `VIGILANCIA_TRANSMISION_ENABLED=false` lo apaga (las pruebas evalúan por endpoint).
 */
@Injectable()
export class VigilanciaTransmisionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VigilanciaTransmisionScheduler.name);
  private timer?: NodeJS.Timeout;
  private enCurso = false;

  constructor(
    private readonly service: VigilanciaTransmisionService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (String(this.config.get('VIGILANCIA_TRANSMISION_ENABLED') ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Vigilancia de transmisión apagada (VIGILANCIA_TRANSMISION_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    setTimeout(() => void this.tick(), 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      await this.service.cerrarResueltos();
      if (dentroDeVentana(nowMexicoCityAsUtcDate())) {
        await this.service.evaluar({ origen: 'sistema' });
      }
    } catch (error) {
      this.logger.error(`Error en la vigilancia de transmisión: ${(error as Error)?.message}`);
    } finally {
      this.enCurso = false;
    }
  }
}

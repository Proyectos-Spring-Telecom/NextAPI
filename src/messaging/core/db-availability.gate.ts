import { Logger } from '@nestjs/common';

export interface DbAvailabilityGateOptions {
  /** Primera espera tras detectar MySQL no disponible. */
  initialDelayMs?: number;
  /** Tope de la espera creciente entre intentos. */
  maxDelayMs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

/**
 * Compuerta compartida por los consumidores: cuando MySQL no responde se
 * cierra y todos esperan (1 s, 2 s, 4 s… hasta `maxDelayMs`) antes de volver a
 * probar. Los mensajes siguen en RabbitMQ sin confirmar; la cola amortigua.
 */
export class DbAvailabilityGate {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private reopenAt = 0;
  private delayMs = 0;
  private downSince: number | null = null;

  constructor(
    private readonly logger: Logger,
    options: DbAvailabilityGateOptions = {},
  ) {
    this.initialDelayMs = options.initialDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
  }

  get isOpen(): boolean {
    return this.downSince === null;
  }

  /** Resuelve cuando toca volver a intentar contra MySQL. */
  async whenOpen(): Promise<void> {
    for (let wait = this.reopenAt - Date.now(); wait > 0; wait = this.reopenAt - Date.now()) {
      await sleep(wait);
    }
  }

  recordUnavailable(reason: string): void {
    const now = Date.now();
    if (now < this.reopenAt) {
      return; // ya cerrada por otro mensaje en esta ventana
    }
    this.delayMs = this.delayMs
      ? Math.min(this.delayMs * 2, this.maxDelayMs)
      : this.initialDelayMs;
    this.reopenAt = now + this.delayMs;
    if (this.downSince === null) {
      this.downSince = now;
      this.logger.warn(
        `MySQL no disponible (${reason}); consumidores en espera, los mensajes se quedan en la cola`,
      );
    }
  }

  recordAvailable(): void {
    if (this.downSince === null) {
      return;
    }
    const seconds = ((Date.now() - this.downSince) / 1000).toFixed(1);
    this.logger.log(`MySQL disponible de nuevo tras ${seconds} s; consumidores reanudados`);
    this.downSince = null;
    this.delayMs = 0;
    this.reopenAt = 0;
  }
}

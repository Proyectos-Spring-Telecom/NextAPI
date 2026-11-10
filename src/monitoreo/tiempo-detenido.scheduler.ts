import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EstatusEnum } from 'src/common/estatus.enum';
import { EnumEstadoTiempoDetenido } from 'src/messaging/shared/estado-tiempo-detenido.util';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { MonitoreoGateway } from './monitoreo.gateway';

const INTERVAL_MS = 60 * 1000;

/**
 * Cada minuto avanza el tiempo detenido de la última posición (0 → 4 → 5 → 6)
 * con la hora actual, sin esperar la siguiente posición: antes llegaba tan
 * tarde como el intervalo de reporte y se congelaba si la unidad dejaba de
 * reportar (10/11/2026, Monitoreo). Solo `UltimaPosicion.Estado`: cada fila de
 * `Posiciones` conserva el estado con el que llegó. Nunca baja ni toca una
 * alerta (solo Estado 0, 4 o 5 con `DetenidoDesde`, que la ingesta pone en
 * null al moverse o en una alerta). Solo instalaciones activas.
 * `TIEMPO_DETENIDO_ENABLED=false` lo apaga (las pruebas llaman a `recalcular`).
 */
@Injectable()
export class TiempoDetenidoScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TiempoDetenidoScheduler.name);
  private timer?: NodeJS.Timeout;
  private enCurso = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly gateway: MonitoreoGateway,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (String(this.config.get('TIEMPO_DETENIDO_ENABLED') ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Tiempo detenido por minuto apagado (TIEMPO_DETENIDO_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      await this.recalcular();
    } catch (error) {
      this.logger.error(`Error al recalcular el tiempo detenido: ${(error as Error)?.message}`);
    } finally {
      this.enCurso = false;
    }
  }

  /** Sube el estado de las unidades que cruzaron 30, 60 o 90 min; devuelve sus IMEI. */
  async recalcular(ahora: Date = nowMexicoCityAsUtcDate()): Promise<string[]> {
    const { DETENIDO, DETENIDO_30_MIN, DETENIDO_60_MIN, DETENIDO_90_MIN } = EnumEstadoTiempoDetenido;
    const objetivo = `CASE
        WHEN TIMESTAMPDIFF(SECOND, u.DetenidoDesde, ?) >= 5400 THEN ${DETENIDO_90_MIN}
        WHEN TIMESTAMPDIFF(SECOND, u.DetenidoDesde, ?) >= 3600 THEN ${DETENIDO_60_MIN}
        WHEN TIMESTAMPDIFF(SECOND, u.DetenidoDesde, ?) >= 1800 THEN ${DETENIDO_30_MIN}
        ELSE ${DETENIDO} END`;
    const filas: Array<{ imei: string | number; estado: number; nuevo: number; desde: Date }> = await this.dataSource.query(
      `SELECT u.Imei AS imei, u.Estado AS estado, ${objetivo} AS nuevo, u.DetenidoDesde AS desde
         FROM UltimaPosicion u
        WHERE u.DetenidoDesde IS NOT NULL
          AND u.Estado IN (${DETENIDO}, ${DETENIDO_30_MIN}, ${DETENIDO_60_MIN})
          AND u.DetenidoDesde <= ? - INTERVAL 30 MINUTE
          AND EXISTS (SELECT 1 FROM Dispositivos d JOIN Instalaciones i ON i.IdDispositivo = d.Id
                       WHERE d.Imei = u.Imei AND i.Estatus = ?)
       HAVING nuevo > estado`,
      [ahora, ahora, ahora, ahora, EstatusEnum.ACTIVO],
    );
    const cambiados: string[] = [];
    for (const f of filas) {
      // Condicional: si entró una posición mientras tanto, gana la ingesta.
      const r = await this.dataSource.query(
        'UPDATE UltimaPosicion SET Estado = ? WHERE Imei = ? AND Estado = ? AND DetenidoDesde = ?',
        [Number(f.nuevo), f.imei, Number(f.estado), f.desde],
      );
      if (Number(r?.affectedRows ?? 0) > 0) cambiados.push(String(f.imei));
    }
    for (const imei of cambiados) void this.gateway.notificarImei(imei);
    if (cambiados.length) this.logger.log(`Tiempo detenido: ${cambiados.length} unidad(es) cambiaron de color`);
    return cambiados;
  }
}

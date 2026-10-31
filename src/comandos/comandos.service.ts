import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';
import { ComandosDispositivo } from 'src/entities/ComandosDispositivo';
import { Dispositivos } from 'src/entities/Dispositivos';
import { RabbitMqConnectionService } from 'src/messaging/core/rabbitmq.connection.service';
import { fechaPared, nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import type { ComandoFa100s } from './comandos-fa100s';

/** México no tiene horario de verano desde 2022: hora de pared = UTC − 6 h. */
const DESFASE_MEXICO_MS = 6 * 3_600_000;
/** Cada cuánto se reintenta publicar lo pendiente y se vence lo viejo. */
const RELAY_MS = 60_000;
const VIGENCIA_HORAS_POR_OMISION = 72;
/** Gracia después de VenceAt para un comando que el socket recibió o envió y no confirmó. */
const GRACIA_VENCIDO_MS = 3_600_000;

/**
 * Comandos de Next a los equipos (docs/motor-activos.md §8): se guardan en
 * ComandosDispositivo (pendiente) y se publican en el exchange `telemetry.commands`. Si
 * RabbitMQ no está, se quedan pendientes y se reintentan cada minuto; el
 * socket los guarda, los entrega cuando el equipo se conecta y confirma.
 */
@Injectable()
export class ComandosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComandosService.name);
  private timer?: NodeJS.Timeout;
  private enCurso = false;
  private readonly publicando = new Set<number>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbit: RabbitMqConnectionService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.relay(), RELAY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private vigenciaMs(): number {
    const h = Number(this.config.get('COMANDOS_VIGENCIA_HORAS') ?? VIGENCIA_HORAS_POR_OMISION) || VIGENCIA_HORAS_POR_OMISION;
    return h * 3_600_000;
  }

  /**
   * Registra los comandos en la transacción del llamador (si la hay) y los
   * publica después. Devuelve los ids, en orden.
   */
  async encolar(
    params: {
      idDispositivo: number;
      protocolo: string;
      comandos: readonly ComandoFa100s[];
      idUsuario: number | null;
      origen?: 'api' | 'sistema';
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const m = manager ?? this.dataSource.manager;
    const ahora = nowMexicoCityAsUtcDate();
    const venceAt = new Date(ahora.getTime() + this.vigenciaMs());
    const ids: number[] = [];
    for (const c of params.comandos) {
      const r = await m.insert(ComandosDispositivo, {
        idDispositivo: params.idDispositivo,
        protocolo: params.protocolo,
        tipo: c.tipo,
        contenido: c.contenido,
        estatus: 'pendiente',
        detalle: null,
        intentos: 0,
        idUsuario: params.idUsuario,
        origen: params.origen ?? 'api',
        venceAt,
        fechaCreacion: ahora,
      });
      ids.push(Number(r.identifiers[0].id));
    }
    return ids;
  }

  /** Publica los comandos indicados (después del commit del llamador). Sin RabbitMQ quedan pendientes. */
  async publicar(ids: readonly number[]): Promise<void> {
    if (!ids.length) return;
    const filas = await this.dataSource.getRepository(ComandosDispositivo).find({
      where: { id: In([...ids]), estatus: 'pendiente' },
      order: { id: 'ASC' },
    });
    for (const f of filas) await this.publicarUno(f);
  }

  private async publicarUno(c: ComandosDispositivo): Promise<boolean> {
    // La publicación tras el commit y el relay pueden tomar el mismo comando: uno a la vez
    // (el socket además deduplica por idComando). NextAPI corre en una sola instancia.
    if (this.publicando.has(Number(c.id))) return false;
    this.publicando.add(Number(c.id));
    try {
      return await this.publicarUnoSinCandado(c);
    } finally {
      this.publicando.delete(Number(c.id));
    }
  }

  private async publicarUnoSinCandado(c: ComandosDispositivo): Promise<boolean> {
    const repo = this.dataSource.getRepository(ComandosDispositivo);
    const equipo = await this.dataSource.getRepository(Dispositivos).findOne({
      where: { id: c.idDispositivo },
      select: { id: true, imei: true },
    });
    if (!equipo?.imei) {
      await repo.update({ id: c.id, estatus: 'pendiente' }, { estatus: 'fallido', detalle: 'El equipo no tiene IMEI' });
      return false;
    }
    try {
      await this.rabbit.publicarComando(c.protocolo, `cmd-${c.id}`, {
        idComando: Number(c.id),
        protocol: c.protocolo,
        deviceId: String(equipo.imei),
        tipo: c.tipo,
        contenido: c.contenido,
        venceAt: new Date(new Date(c.venceAt).getTime() + DESFASE_MEXICO_MS).toISOString(),
        creadoAt: new Date(new Date(c.fechaCreacion).getTime() + DESFASE_MEXICO_MS).toISOString(),
      });
      await repo.update(
        { id: c.id, estatus: 'pendiente' },
        { estatus: 'publicado', fechaPublicado: nowMexicoCityAsUtcDate(), intentos: Number(c.intentos) + 1, detalle: null },
      );
      return true;
    } catch (error) {
      await repo.update(
        { id: c.id, estatus: 'pendiente' },
        { intentos: Number(c.intentos) + 1, detalle: `Sin publicar: ${(error as Error)?.message}`.slice(0, 500) },
      );
      return false;
    }
  }

  /** Reintenta publicar lo pendiente y vence lo que pasó su vigencia. */
  async relay(): Promise<{ publicados: number; vencidos: number }> {
    if (this.enCurso) return { publicados: 0, vencidos: 0 };
    this.enCurso = true;
    try {
      const repo = this.dataSource.getRepository(ComandosDispositivo);
      const ahora = nowMexicoCityAsUtcDate();
      // Sin publicar: vencen al pasar VenceAt. Ya en el socket: él reporta el vencido; si
      // no lo hace (socket caído), vencen una hora después.
      const v1 = await repo.update(
        { estatus: In(['pendiente', 'publicado']), venceAt: LessThan(ahora) },
        { estatus: 'vencido', detalle: 'No llegó al socket antes de su vigencia' },
      );
      const v2 = await repo.update(
        { estatus: In(['recibido', 'enviado']), venceAt: LessThan(new Date(ahora.getTime() - GRACIA_VENCIDO_MS)) },
        { estatus: 'vencido', detalle: 'Sin confirmación del equipo' },
      );
      let publicados = 0;
      // Sin RabbitMQ no se intenta (ni se reescribe cada minuto el detalle de lo pendiente).
      if (!this.rabbit.comandosDisponible()) {
        return { publicados, vencidos: (v1.affected ?? 0) + (v2.affected ?? 0) };
      }
      const pendientes = await repo.find({ where: { estatus: 'pendiente' }, order: { id: 'ASC' }, take: 200 });
      for (const c of pendientes) {
        if (await this.publicarUno(c)) publicados++;
        else break; // RabbitMQ no está: el siguiente minuto.
      }
      return { publicados, vencidos: (v1.affected ?? 0) + (v2.affected ?? 0) };
    } catch (error) {
      this.logger.warn(`relay de comandos: ${(error as Error)?.message}`);
      return { publicados: 0, vencidos: 0 };
    } finally {
      this.enCurso = false;
    }
  }

  /** Comandos de un equipo, del más reciente al más antiguo. */
  async listar(idDispositivo: number) {
    const filas = await this.dataSource.getRepository(ComandosDispositivo).find({
      where: { idDispositivo },
      order: { id: 'DESC' },
      take: 100,
    });
    const f = (d: Date | null) => (d ? fechaPared(new Date(d)) : null);
    return {
      data: filas.map((c) => ({
        id: Number(c.id),
        tipo: c.tipo,
        contenido: c.contenido,
        estatus: c.estatus,
        detalle: c.detalle,
        intentos: Number(c.intentos),
        idUsuario: c.idUsuario != null ? Number(c.idUsuario) : null,
        origen: c.origen,
        fechaCreacion: f(c.fechaCreacion),
        fechaPublicado: f(c.fechaPublicado),
        fechaRecibido: f(c.fechaRecibido),
        fechaEnviado: f(c.fechaEnviado),
        fechaConfirmado: f(c.fechaConfirmado),
        venceAt: f(c.venceAt),
      })),
    };
  }
}

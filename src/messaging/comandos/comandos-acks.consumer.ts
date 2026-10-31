import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ComandosDispositivo } from 'src/entities/ComandosDispositivo';
import { ParametrosTrackCam } from 'src/entities/ParametrosTrackCam';
import { idEquipoComando } from 'src/comandos/id-equipo';
import { itemComando } from 'src/comandos/item-comando';
import { Instalaciones } from 'src/entities/Instalaciones';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { Dispositivos } from 'src/entities/Dispositivos';
import { aplicaAck, ESTADOS_ACK, estatusQueAceptan, type EstadoAck, type EstatusComando } from 'src/comandos/estados-comando';
import { isoUtcToMexicoCityAsUtcDate, nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';

const FECHA_POR_ESTADO: Partial<Record<EstadoAck, keyof ComandosDispositivo>> = {
  recibido: 'fechaRecibido',
  enviado: 'fechaEnviado',
  confirmado: 'fechaConfirmado',
};

/**
 * Confirmaciones de los sockets (`<protocolo>.cmd.ack`): avanzan el estatus del
 * comando. Un ack de otro equipo, de un comando inexistente o que haría
 * retroceder el estatus se ignora (ack del mensaje, sin DLQ).
 */
@Injectable()
export class ComandosAcksConsumer {
  private readonly logger = new Logger(ComandosAcksConsumer.name);

  constructor(
    @InjectRepository(ComandosDispositivo)
    private readonly comandosRepo: Repository<ComandosDispositivo>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @Optional() private readonly gateway?: MonitoreoGateway,
  ) {}

  async consume(msg: ConsumeMessage): Promise<void> {
    const body = JSON.parse(msg.content.toString('utf8')) as Record<string, unknown>;
    await this.aplicar(body);
  }

  /** Separado del mensaje AMQP para probarlo y para reprocesar acks. */
  async aplicar(body: Record<string, unknown>): Promise<'aplicado' | 'ignorado'> {
    const idComando = Number(body.idComando);
    const estado = String(body.estado ?? '') as EstadoAck;
    if (body.kind !== 'command_ack' || !Number.isFinite(idComando) || !ESTADOS_ACK.includes(estado)) {
      throw new Error(`ack de comando inválido (kind=${String(body.kind)}, idComando=${String(body.idComando)}, estado=${estado})`);
    }
    const comando = await this.comandosRepo.findOne({ where: { id: idComando } });
    if (!comando) {
      this.logger.warn(`ack de un comando que no existe: ${idComando}`);
      return 'ignorado';
    }
    const equipo = await this.dispositivosRepo.findOne({
      where: { id: comando.idDispositivo },
      select: { id: true, imei: true, numeroSerie: true },
    });
    if (!equipo || idEquipoComando(comando.protocolo, equipo) !== String(body.deviceId ?? '').trim()) {
      this.logger.warn(`ack del comando ${idComando} desde otro equipo (${String(body.deviceId)}): se ignora`);
      return 'ignorado';
    }
    if (!aplicaAck(comando.estatus as EstatusComando, estado)) return 'ignorado';
    const resultado = esObjeto(body.resultado) ? body.resultado : null;
    const at = typeof body.at === 'string' ? isoUtcToMexicoCityAsUtcDate(body.at) : nowMexicoCityAsUtcDate();
    const campo = FECHA_POR_ESTADO[estado];
    // Una sola escritura condicional a los estatus desde los que este ack avanza:
    // dos acks a la vez (recibido y enviado llegan juntos) o el vencimiento del
    // relay no se pisan, y "confirmado" nunca se pierde.
    const r = await this.comandosRepo.update(
      { id: idComando, estatus: In(estatusQueAceptan(estado)) },
      {
        estatus: estado,
        ...(campo ? { [campo]: at } : {}),
        ...(body.detalle != null ? { detalle: String(body.detalle).slice(0, 500) } : {}),
        // JSON: TypeORM tipa la columna como objeto parcial; el valor va tal cual.
        ...(resultado ? { resultado: resultado as QueryDeepPartialEntity<ComandosDispositivo>['resultado'] } : {}),
      },
    );
    if (!r.affected) return 'ignorado';
    // También en fallido: la cámara pudo aplicar una parte y trae lo que quedó.
    if ((estado === 'confirmado' || estado === 'fallido') && comando.protocolo === 'jt808' && resultado) {
      await this.guardarLectura(Number(comando.idDispositivo), resultado);
    }
    await this.notificar(idComando);
    return 'aplicado';
  }

  /**
   * Tiempo real (`comando:actualizacion` en `/monitoreo`, room de la
   * instalación activa del equipo): la consola de configuración ve avanzar el
   * comando sin consultar. Nunca falla el ack.
   */
  private async notificar(idComando: number): Promise<void> {
    if (!this.gateway) return;
    try {
      const comando = await this.comandosRepo.findOne({ where: { id: idComando } });
      if (!comando) return;
      const inst = await this.comandosRepo.manager.findOne(Instalaciones, {
        where: { idDispositivo: comando.idDispositivo, estatus: 1 },
        select: { id: true },
      });
      if (!inst) return;
      // Mismos roles que los GET: reloj 1–6 (`…/reloj/comandos`), TrackCam 1–5.
      this.gateway.emitComando(
        { idInstalacion: Number(inst.id), idDispositivo: Number(comando.idDispositivo), comando: itemComando(comando) },
        comando.protocolo === 'fa100s' ? 'operacion_y_cliente' : 'operacion',
      );
    } catch (error) {
      this.logger.warn(`comando ${idComando}: no se pudo notificar: ${(error as Error)?.message}`);
    }
  }

  /**
   * La lectura de la TrackCam (al confirmar o fallar PARAMS, o LEERPARAMS) reemplaza la
   * guardada, salvo que ya haya una más nueva: dos acks fuera de orden no
   * regresan a valores viejos.
   */
  private async guardarLectura(idDispositivo: number, resultado: Record<string, unknown>): Promise<void> {
    if (!esObjeto(resultado.parametros)) return;
    const fecha = typeof resultado.leidoAt === 'string' ? isoUtcToMexicoCityAsUtcDate(resultado.leidoAt) : nowMexicoCityAsUtcDate();
    const tabla = this.comandosRepo.manager.getRepository(ParametrosTrackCam).metadata.tablePath;
    await this.comandosRepo.query(
      `INSERT INTO ${tabla} (IdDispositivo, Leido, FechaLectura) VALUES (?, CAST(? AS JSON), ?)
       ON DUPLICATE KEY UPDATE
         Leido = IF(FechaLectura IS NULL OR FechaLectura <= VALUES(FechaLectura), VALUES(Leido), Leido),
         FechaLectura = IF(FechaLectura IS NULL OR FechaLectura <= VALUES(FechaLectura), VALUES(FechaLectura), FechaLectura)`,
      [idDispositivo, JSON.stringify(resultado.parametros), fecha],
    );
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

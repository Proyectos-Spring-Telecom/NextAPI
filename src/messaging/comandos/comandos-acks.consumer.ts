import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { In, Repository } from 'typeorm';
import { ComandosDispositivo } from 'src/entities/ComandosDispositivo';
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
    const equipo = await this.dispositivosRepo.findOne({ where: { id: comando.idDispositivo }, select: { id: true, imei: true } });
    if (!equipo || String(equipo.imei ?? '') !== String(body.deviceId ?? '')) {
      this.logger.warn(`ack del comando ${idComando} desde otro equipo (${String(body.deviceId)}): se ignora`);
      return 'ignorado';
    }
    if (!aplicaAck(comando.estatus as EstatusComando, estado)) return 'ignorado';
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
      },
    );
    return r.affected ? 'aplicado' : 'ignorado';
  }
}

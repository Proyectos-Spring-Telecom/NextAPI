import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { WebhookEmitterService } from 'src/webhook-emitter/webhook-emitter.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';
import { RELACIONES_DETALLE_TRACKCAM, buildTrackcamWebhookData } from 'src/dispositivos/map-relaciones.util';

/**
 * Registro de una TrackCam en el gateway (springTrackCam, webhook
 * `trackcam.created|updated`). `tenantId` es el cliente del equipo; en almacén
 * (sin cliente) va 0, así la cámara sigue en la lista blanca y se prueba en
 * banco. Lo usan el CRUD de TrackCam y las instalaciones, que le cambian el
 * cliente al instalarla o desinstalarla (fase B).
 */
@Injectable()
export class RegistroTrackcamService {
  private readonly logger = new Logger(RegistroTrackcamService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly webhookEmitter: WebhookEmitterService,
  ) {}

  /** Emite el registro de los dispositivos que sean TrackCam; los demás se ignoran. */
  async emitir(event: WebhookEvent, idsDispositivo: ReadonlyArray<number | null | undefined>): Promise<void> {
    for (const id of new Set(idsDispositivo.filter((x): x is number => x != null).map(Number))) {
      try {
        const entity = await this.dataSource.getRepository(TrackcamConfig).findOne({
          where: { idDispositivo: id },
          relations: RELACIONES_DETALLE_TRACKCAM,
        });
        if (!entity) continue;
        const idCliente = entity.idDispositivo2?.idCliente;
        this.webhookEmitter.emit(event, idCliente != null ? Number(idCliente) : 0, id, buildTrackcamWebhookData(entity));
      } catch (error) {
        // Nunca frena la operación: el gateway se vuelve a sincronizar con el siguiente cambio.
        this.logger.warn(`No se pudo emitir el registro de la TrackCam ${id}: ${(error as Error)?.message}`);
      }
    }
  }
}

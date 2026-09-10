import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EstatusEnum } from 'src/common/estatus.enum';
import { Fotos } from 'src/entities/Fotos';
import { Geocercas } from 'src/entities/Geocercas';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { Videos } from 'src/entities/Videos';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { isDuplicateKeyError } from '../core/db-errors.util';
import {
  debeEvaluarGeocerca,
  estaFueraDeAlgunaGeocerca,
  ESTADO_FUERA_GEOCERCA,
} from './estado-geocerca.util';
import {
  debeAplicarTiempoDetenido,
  estadoPorMinutosDetenido,
  minutosEntre,
  VELOCIDAD_EN_MOVIMIENTO_MIN,
} from './estado-tiempo-detenido.util';
import { isPublicHttpUrl } from './media-url.util';
import {
  PosicionIngestAlarmRequest,
  PosicionIngestMedia,
  PosicionIngestPositionRequest,
  PosicionIngestResult,
} from './posicion-ingest.types';

/**
 * Núcleo compartido: cualquier gateway GPS/dashcam inserta aquí.
 *
 * - position/photo → TelemetryIngestLog + media + Posiciones + WS
 * - alarm → solo TelemetryIngestLog (NO Posiciones; evita GPS duplicado)
 * - Geocerca (Estado=8): RASTREADOR/AVL/TELEFONO/TRACKCAM/TRACKGAS; geocerca con IdInstalacion
 * - Tiempo detenido (4/5/6): AVL/TRACKCAM/TRACKGAS si Estado=0 y Velocidad=0
 *
 * Cada protocolo: cola AMQP propia + mapper → este servicio.
 * Ver: docs/CHECKLIST-NUEVO-GATEWAY-TELEMETRIA.md
 */
@Injectable()
export class PosicionIngestService {
  private readonly logger = new Logger(PosicionIngestService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoreoGateway: MonitoreoGateway,
  ) {}

  /**
   * Whitelist / push / auditoría — sin INSERT Posiciones.
   */
  async ingestAlarm(
    req: PosicionIngestAlarmRequest,
  ): Promise<PosicionIngestResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const logged = await this.tryInsertIngestLog(manager, req);
      if (logged.duplicate) return logged;

      this.logger.log(
        `[PosicionIngest] alarm protocol=${req.protocol} eventId=${req.eventId} deviceId=${req.deviceId} imei=${req.imei} rk=${req.routingKey} (sin Posiciones)`,
      );
      return { audited: true as const };
    });

    return result;
  }

  /**
   * GPS / ACC / media / evento dominante → Posiciones + UltimaPosicion (trigger) + WS.
   */
  async ingestPosition(
    req: PosicionIngestPositionRequest,
  ): Promise<PosicionIngestResult> {
    const posicionData: Partial<Posiciones> = { ...req.posicion, imei: req.imei };

    const result = await this.dataSource.transaction(async (manager) => {
      const logged = await this.tryInsertIngestLog(manager, req);
      if (logged.duplicate) return logged;

      await this.attachMediaIds(
        manager,
        req.imei,
        req.media,
        posicionData,
      );

      await this.aplicarGeocercaSiCorresponde(
        manager,
        req.idTipoDispositivo,
        req.idInstalacion,
        posicionData,
      );

      await this.aplicarTiempoDetenidoSiCorresponde(
        manager,
        req.imei,
        req.idTipoDispositivo,
        posicionData,
      );

      const insertResult = await manager.insert(Posiciones, posicionData);
      const posicionId = Number(insertResult.identifiers[0]?.id);

      await manager.update(
        TelemetryIngestLog,
        { eventId: req.eventId },
        { posicionId },
      );

      this.logger.log(
        `[PosicionIngest] ${req.kind} protocol=${req.protocol} eventId=${req.eventId} → PosicionId=${posicionId} Estado=${posicionData.estado ?? 'NULL'}`,
      );

      return { posicionId };
    });

    if (!result.duplicate && result.posicionId != null) {
      void this.monitoreoGateway.notificarImei(req.imei);
    }

    return result;
  }

  /**
   * Prioridad 3 Sion: fuera de alguna geocerca de la instalación → Estado=8.
   * No pisa botón (2/3) ni energía (10). Geocercas con IdInstalacion NULL no aplican.
   */
  private async aplicarGeocercaSiCorresponde(
    manager: EntityManager,
    idTipoDispositivo: number | null | undefined,
    idInstalacion: number | null | undefined,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    if (
      !debeEvaluarGeocerca({
        idTipoDispositivo,
        idInstalacion,
        estado: posicionData.estado,
        lat: posicionData.lat,
        lng: posicionData.lng,
      })
    ) {
      return;
    }

    const geocercas = await manager
      .createQueryBuilder(Geocercas, 'g')
      .where('g.idInstalacion = :idInstalacion', {
        idInstalacion: Number(idInstalacion),
      })
      .andWhere('g.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .getMany();

    if (geocercas.length === 0) {
      return;
    }

    const fuera = estaFueraDeAlgunaGeocerca(
      Number(posicionData.lat),
      Number(posicionData.lng),
      geocercas.map((g) => g.geocerca),
    );

    if (!fuera) {
      return;
    }

    this.logger.debug(
      `[PosicionIngest] geocerca fuera idInstalacion=${idInstalacion} → Estado=${ESTADO_FUERA_GEOCERCA}`,
    );
    posicionData.estado = ESTADO_FUERA_GEOCERCA;
  }

  /**
   * Prioridad Sion: solo si ya quedó Estado=0 y Velocidad=0 (AVL/TRACKCAM/TRACKGAS).
   * Otros estados (alertas / geocerca) se conservan.
   */
  private async aplicarTiempoDetenidoSiCorresponde(
    manager: EntityManager,
    imei: string,
    idTipoDispositivo: number | null | undefined,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    if (
      !debeAplicarTiempoDetenido({
        idTipoDispositivo,
        estado: posicionData.estado,
        velocidad: posicionData.velocidad,
      })
    ) {
      return;
    }

    const fechaActual = posicionData.fechaHora;
    if (fechaActual == null) {
      return;
    }

    const ultimaMovimiento = await this.buscarUltimaFechaEnMovimiento(
      manager,
      imei,
      fechaActual,
    );
    if (!ultimaMovimiento) {
      return;
    }

    const minutos = minutosEntre(ultimaMovimiento, fechaActual);
    if (minutos == null) {
      return;
    }

    const estadoNuevo = estadoPorMinutosDetenido(minutos);
    if (estadoNuevo === Number(posicionData.estado)) {
      return;
    }

    this.logger.debug(
      `[PosicionIngest] tiempoDetenido imei=${imei} minutos=${minutos.toFixed(1)} → Estado=${estadoNuevo}`,
    );
    posicionData.estado = estadoNuevo;
  }

  /** Última posición del IMEI en movimiento (Velocidad > 5 o Estado = 1) antes de fechaActual. */
  private async buscarUltimaFechaEnMovimiento(
    manager: EntityManager,
    imei: string,
    fechaActual: Date | string,
  ): Promise<Date | string | null> {
    const row = await manager
      .createQueryBuilder(Posiciones, 'p')
      .select('p.fechaHora', 'fechaHora')
      .where('p.imei = :imei', { imei })
      .andWhere('p.fechaHora < :fechaActual', { fechaActual })
      .andWhere('(p.velocidad > :velMin OR p.estado = :estadoMov)', {
        velMin: VELOCIDAD_EN_MOVIMIENTO_MIN,
        estadoMov: 1,
      })
      .orderBy('p.fechaHora', 'DESC')
      .limit(1)
      .getRawOne<{ fechaHora: Date | string }>();

    return row?.fechaHora ?? null;
  }

  private async tryInsertIngestLog(
    manager: EntityManager,
    req: Pick<
      PosicionIngestAlarmRequest,
      | 'eventId'
      | 'protocol'
      | 'kind'
      | 'deviceId'
      | 'routingKey'
      | 'auditPayload'
    >,
  ): Promise<PosicionIngestResult> {
    try {
      await manager.insert(TelemetryIngestLog, {
        eventId: req.eventId,
        protocol: req.protocol,
        kind: String(req.kind),
        deviceId: req.deviceId,
        routingKey: req.routingKey,
        payloadJson: req.auditPayload ?? undefined,
      });
      return {};
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  private async attachMediaIds(
    manager: EntityManager,
    imei: string,
    media: PosicionIngestMedia | undefined,
    posicionData: Partial<Posiciones>,
  ): Promise<void> {
    if (!media) {
      posicionData.idFoto = null;
      posicionData.idFoto1 = null;
      posicionData.idFoto2 = null;
      posicionData.idFoto3 = null;
      posicionData.idVideo1 = null;
      posicionData.idVideo2 = null;
      posicionData.idVideo3 = null;
      return;
    }

    const fechaHora = posicionData.fechaHora ?? null;
    const multimediaId =
      media.multimediaId != null ? Number(media.multimediaId) : null;

    posicionData.idFoto1 = await this.insertFotoIfUrl(manager, {
      imei,
      url: media.Foto1,
      fechaHora,
      idFotoJt808: multimediaId,
    });
    posicionData.idFoto2 = await this.insertFotoIfUrl(manager, {
      imei,
      url: media.Foto2,
      fechaHora,
      idFotoJt808: null,
    });
    posicionData.idFoto3 = await this.insertFotoIfUrl(manager, {
      imei,
      url: media.Foto3,
      fechaHora,
      idFotoJt808: null,
    });
    posicionData.idVideo1 = await this.insertVideoIfUrl(manager, {
      imei,
      url: media.Video1,
      fechaHora,
    });
    posicionData.idVideo2 = await this.insertVideoIfUrl(manager, {
      imei,
      url: media.Video2,
      fechaHora,
    });
    posicionData.idVideo3 = await this.insertVideoIfUrl(manager, {
      imei,
      url: media.Video3,
      fechaHora,
    });
    posicionData.idFoto = null;
  }

  private async insertFotoIfUrl(
    manager: EntityManager,
    args: {
      imei: string;
      url: string | null | undefined;
      fechaHora: Date | null;
      idFotoJt808: number | null;
    },
  ): Promise<number | null> {
    if (!isPublicHttpUrl(args.url)) return null;
    const ruta = args.url!.trim();
    const result = await manager.insert(Fotos, {
      imei: args.imei,
      idFoto: args.idFotoJt808,
      ruta,
      rutaServidor: null,
      fechaHora: args.fechaHora,
    });
    return Number(result.identifiers[0]?.id);
  }

  private async insertVideoIfUrl(
    manager: EntityManager,
    args: {
      imei: string;
      url: string | null | undefined;
      fechaHora: Date | null;
    },
  ): Promise<number | null> {
    if (!isPublicHttpUrl(args.url)) return null;
    const ruta = args.url!.trim();
    const result = await manager.insert(Videos, {
      imei: args.imei,
      ruta,
      rutaServidor: null,
      fechaHora: args.fechaHora,
    });
    return Number(result.identifiers[0]?.id);
  }
}

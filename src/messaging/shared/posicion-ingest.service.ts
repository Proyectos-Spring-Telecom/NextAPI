import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EstatusEnum } from 'src/common/estatus.enum';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { EstatusRecurso } from 'src/motor-activos/estatus-recurso';
import { Fotos } from 'src/entities/Fotos';
import { Geocercas } from 'src/entities/Geocercas';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { Videos } from 'src/entities/Videos';
import { IncidentesAutoService } from 'src/incidentes/auto/incidentes-auto.service';
import {
  esEstadoAlertaConsola,
  iniciaAlertaConsola,
} from 'src/incidentes/incidentes-alerta.util';
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
  inicioConteoDetenido,
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
import { FuentePosicion } from 'src/common/fuente-posicion';

/**
 * Núcleo compartido: cualquier gateway GPS/dashcam inserta aquí.
 *
 * - position/photo → TelemetryIngestLog + media + Posiciones + WS
 * - alarm → solo TelemetryIngestLog (NO Posiciones; evita GPS duplicado)
 * - Geocerca (Estado=8): RASTREADOR/AVL/TELEFONO/TRACKCAM/TRACKGAS; geocercas del vehículo (IdProducto)
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
    private readonly incidentesAuto: IncidentesAutoService,
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

      this.logger.debug(
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
    /** true si esta posición inicia una alerta de Consola (se abre incidente). */
    let abreIncidente = false;

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

      // Antes del INSERT: el trigger actualiza UltimaPosicion con esta fila.
      // Sin instalación activa la posición es evidencia (almacén, taller):
      // no le abre incidentes a ningún cliente (docs/motor-activos.md §7).
      abreIncidente =
        (await this.iniciaAlerta(manager, req.imei, posicionData)) &&
        (req.idInstalacion != null || (await this.instalacionActiva(manager, req.imei)));

      const insertResult = await manager.insert(Posiciones, posicionData);
      const posicionId = Number(insertResult.identifiers[0]?.id);

      await manager.update(
        TelemetryIngestLog,
        { eventId: req.eventId },
        { posicionId },
      );

      this.logger.debug(
        `[PosicionIngest] ${req.kind} protocol=${req.protocol} eventId=${req.eventId} → PosicionId=${posicionId} Estado=${posicionData.estado ?? 'NULL'}`,
      );

      return { posicionId };
    });

    if (!result.duplicate && result.posicionId != null) {
      void this.monitoreoGateway.notificarImei(req.imei);
      if (Number(req.estatusDispositivo) === EstatusRecurso.INSERVIBLE) {
        // Un equipo dado por inservible no debería transmitir: posible robo o
        // vandalismo. Fuera de la transacción y sin esperar, como las alertas.
        void this.incidentesAuto.registrarInservibleTransmite(result.posicionId, req.imei);
      }
      if (abreIncidente) {
        // Fuera de la transacción y sin esperar: nunca frena el ingest.
        void this.incidentesAuto.registrarDesdePosicion(
          result.posicionId,
          req.imei,
          Number(posicionData.estado),
          posicionData.idEvento ?? null,
        );
      }
    }

    return result;
  }

  /**
   * Ubicación que llegó después para una alarma sin GPS (relojes FA100S):
   * corrige Lat/Lng de la posición de esa alarma (mismo Imei, FechaHora e
   * IdEvento) sin crear otra fila ni abrir otro incidente. Si la alarma no
   * llegó a Posiciones (no había posición previa), se inserta como posición.
   */
  async ingestAlarmLocation(
    req: PosicionIngestPositionRequest,
  ): Promise<PosicionIngestResult> {
    const { fechaHora, idEvento, lat, lng } = req.posicion;
    if (fechaHora == null || idEvento == null) {
      return this.ingestPosition(req);
    }
    const original = await this.dataSource.getRepository(Posiciones).findOne({
      select: { id: true },
      where: { imei: req.imei, fechaHora, idEvento },
      order: { id: 'DESC' },
    });
    if (!original) {
      return this.ingestPosition(req);
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const logged = await this.tryInsertIngestLog(manager, req);
      if (logged.duplicate) return logged;

      // La ubicación posterior es GPS: también corrige el origen y el radio.
      const ubicacion = {
        lat,
        lng,
        fuentePosicion: req.posicion.fuentePosicion ?? FuentePosicion.GPS,
        radioM: req.posicion.radioM ?? null,
      };
      await manager.update(Posiciones, { id: original.id }, ubicacion);
      // Solo si la alarma sigue siendo la última posición del equipo.
      await manager.update(UltimaPosicion, { imei: req.imei, fechaHora }, ubicacion);
      await manager.update(
        TelemetryIngestLog,
        { eventId: req.eventId },
        { posicionId: original.id },
      );
      this.logger.debug(
        `[PosicionIngest] alarm_location protocol=${req.protocol} eventId=${req.eventId} → PosicionId=${original.id} corregida`,
      );
      return { posicionId: original.id };
    });

    if (!result.duplicate) {
      void this.monitoreoGateway.notificarImei(req.imei);
    }
    return result;
  }

  /**
   * La búsqueda del equipo tiene caché: un equipo recién instalado puede
   * llegar como "sin instalación" unos minutos. Solo se consulta cuando la
   * posición abriría un incidente.
   */
  private async instalacionActiva(manager: EntityManager, imei: string): Promise<boolean> {
    const fila = await manager
      .createQueryBuilder(Instalaciones, 'i')
      .innerJoin(Dispositivos, 'd', 'd.id = i.idDispositivo')
      .select('i.id', 'id')
      .where('d.imei = :imei AND i.estatus = :activa', { imei, activa: EstatusEnum.ACTIVO })
      .getRawOne<{ id: string | number }>();
    return fila != null;
  }

  /**
   * Solo consulta UltimaPosicion cuando el estado nuevo es de alerta (2, 3, 8,
   * 9, 10, 11). Si falla la lectura no se abre incidente y el ingest sigue.
   */
  private async iniciaAlerta(
    manager: EntityManager,
    imei: string,
    posicionData: Partial<Posiciones>,
  ): Promise<boolean> {
    if (!esEstadoAlertaConsola(posicionData.estado)) return false;
    try {
      const previo = await manager
        .createQueryBuilder(UltimaPosicion, 'u')
        .select('u.estado', 'estado')
        .addSelect('u.idEvento', 'idEvento')
        .where('u.imei = :imei', { imei })
        .getRawOne<{
          estado: number | string | null;
          idEvento: number | string | null;
        }>();
      return iniciaAlertaConsola(
        posicionData.estado,
        previo?.estado ?? null,
        posicionData.idEvento,
        previo?.idEvento ?? null,
      );
    } catch (error) {
      this.logger.warn(
        `[PosicionIngest] no se pudo leer estado previo imei=${imei}: ${(error as Error)?.message}`,
      );
      return false;
    }
  }

  /**
   * Prioridad 3 Sion: fuera de alguna geocerca del vehículo de la instalación
   * (`Geocercas.IdProducto`, fase C) → Estado=8. No pisa botón (2/3) ni energía
   * (10). Geocercas sin vehículo no aplican.
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

    // Las del vehículo: siguen aunque cambie el equipo, y aplican a cada equipo del vehículo.
    const geocercas = await manager
      .createQueryBuilder(Geocercas, 'g')
      .innerJoin(Instalaciones, 'i', 'i.idProducto = g.idProducto AND i.idCliente = g.idCliente')
      .where('i.id = :idInstalacion', {
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
   * Los minutos se cuentan desde el primer encendido de ignición posterior al
   * último movimiento (detenido con motor encendido); sin encendido → Estado 0.
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

    // Regla SION: el tiempo detenido cuenta desde el primer encendido de
    // ignición posterior al último movimiento. Sin encendido → se queda en 0.
    const primerEncendido = await this.buscarPrimerEncendidoTrasMovimiento(
      manager,
      imei,
      ultimaMovimiento,
      fechaActual,
    );
    const inicioConteo = inicioConteoDetenido({
      primerEncendidoTrasMovimiento: primerEncendido,
      ignicionActual: posicionData.ignicion,
      fechaActual,
    });
    if (!inicioConteo) {
      return;
    }

    const minutos = minutosEntre(inicioConteo, fechaActual);
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

  /**
   * Primera posición guardada con ignición encendida después del último
   * movimiento y antes de la actual. Solo lectura; usa IMEI + FechaHora.
   */
  private async buscarPrimerEncendidoTrasMovimiento(
    manager: EntityManager,
    imei: string,
    desde: Date | string,
    fechaActual: Date | string,
  ): Promise<Date | string | null> {
    const row = await manager
      .createQueryBuilder(Posiciones, 'p')
      .select('p.fechaHora', 'fechaHora')
      .where('p.imei = :imei', { imei })
      .andWhere('p.fechaHora > :desde', { desde })
      .andWhere('p.fechaHora < :fechaActual', { fechaActual })
      .andWhere('p.ignicion = :encendida', { encendida: 1 })
      .orderBy('p.fechaHora', 'ASC')
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

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumRoles,
  EnumTipoDispositivo,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Usuarios } from 'src/entities/Usuarios';
import { Fotos } from 'src/entities/Fotos';
import { Videos } from 'src/entities/Videos';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { Activos } from 'src/entities/Activos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Personas } from 'src/entities/Personas';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { obtenerTipoTrackcam } from 'src/dispositivos/crear-dispositivo.util';
import {
  mapPuntoInteresPlano,
  RELACIONES_PUNTO_INTERES,
} from 'src/puntos-interes/map-puntos-interes.util';
import {
  applyMonitoreoListJoins,
  applyMonitoreoListSelect,
} from './helpers/monitoreo-sql.helpers';
import { calcularDistanciaHistoricoMonitoreo } from './helpers/monitoreo-distancia.helpers';
import {
  mapContextoDesdeRow,
  mapHistoricoPosicionItem,
  parseFechaHistorico,
  formatFechaPosicion,
  HistoricoMonitoreoResponse,
} from './helpers/monitoreo-historico.helpers';
import {
  mapMonitoreoPosicionItem,
  MonitoreoPosicionItem,
  num,
} from './monitoreo.mapper';
import {
  TrackcamGatewayClient,
  TrackcamGatewayPhotoResponse,
  TrackcamGatewayVideoResponse,
} from './trackcam-gateway.client';

type TrackcamInstalacionDevice = {
  idInstalacion: number;
  idDispositivo: number;
  terminalId: string;
  imei: string;
};

export type MonitoreoListadoResponse = {
  posicion: MonitoreoPosicionItem[];
  'puntos-interes': ReturnType<typeof mapPuntoInteresPlano>[];
};

/** Ítem plano de consola (`UltimaPosicion`). */
export type ConsolaUltimaPosicionItem = {
  id: number;
  imei: string | null;
  lat: number;
  lng: number;
  estado: number | null;
  fechaHora: string | null;
  velocidad: number | null;
  direccion: number | null;
  odometro: number | null;
  ignicion: number | null;
  alarma1: number | null;
  alarma2: number | null;
  energia: number | null;
  idEvento: number | null;
  idFoto: number | null;
  fhRegistro: string | null;
  bateria: number | null;
  alimentacion: number | null;
  gps: number | null;
  gsm: number | null;
  movimiento: number | null;
  combustible: number | null;
  idFoto1: number | null;
  idFoto2: number | null;
  idFoto3: number | null;
  idVideo1: number | null;
  idVideo2: number | null;
  idVideo3: number | null;
  idInstalacion: number | null;
  idCliente: number | null;
  idDispositivo: number | null;
};

export type ConsolaMonitoreoResponse = {
  posicion: ConsolaUltimaPosicionItem[];
};

/** Mismo shape plano que `posicion[]` del listado (sin puntos-interes). */
export type MonitoreoInstalacionesUsuariosResponse = {
  posicion: MonitoreoPosicionItem[];
};

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(UltimaPosicion)
    private readonly ultimaPosicionRepo: Repository<UltimaPosicion>,
    @InjectRepository(PuntosInteres)
    private readonly puntosInteresRepo: Repository<PuntosInteres>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    private readonly tenantFilter: TenantFilterService,
    private readonly trackcamGateway: TrackcamGatewayClient,
  ) { }

  /**
   * Consola: filas de `UltimaPosicion` visibles según rol/tenant,
   * ordenadas de la más reciente a la más antigua (`FechaHora` DESC).
   */
  async consola(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ConsolaMonitoreoResponse> {
    try {
      const qb = this.createConsolaQueryBuilder();

      const visible = await this.applyVisibilidadInstalaciones(
        qb as unknown as SelectQueryBuilder<Instalaciones>,
        idUsuario,
        idClienteToken,
        rol,
      );
      if (!visible) {
        return { posicion: [] };
      }

      qb.orderBy('up.fechaHora', 'DESC').addOrderBy('up.id', 'DESC');

      const rows = await qb.getRawMany<Record<string, unknown>>();
      return {
        posicion: rows.map((row) => this.mapConsolaUltimaPosicion(row)),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener consola de última posición',
        error: (error as Error)?.message,
      });
    }
  }

  /** Ítem plano de consola por IMEI (mismo shape que GET /monitoreo/consola). */
  async obtenerConsolaPorImei(
    imei: string,
  ): Promise<ConsolaUltimaPosicionItem | null> {
    const qb = this.createConsolaQueryBuilder();
    qb.andWhere('up.imei = :imei', { imei });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? this.mapConsolaUltimaPosicion(row) : null;
  }

  async obtenerConsolaPorInstalacion(
    idInstalacion: number,
  ): Promise<ConsolaUltimaPosicionItem | null> {
    const qb = this.createConsolaQueryBuilder();
    qb.andWhere('i.id = :idInstalacion', { idInstalacion });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? this.mapConsolaUltimaPosicion(row) : null;
  }

  async obtenerConsolaPorDispositivo(
    idDispositivo: number,
  ): Promise<ConsolaUltimaPosicionItem | null> {
    const qb = this.createConsolaQueryBuilder();
    qb.andWhere('d.id = :idDispositivo', { idDispositivo });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? this.mapConsolaUltimaPosicion(row) : null;
  }

  private createConsolaQueryBuilder() {
    return this.ultimaPosicionRepo
      .createQueryBuilder('up')
      .innerJoin(Dispositivos, 'd', 'd.imei = up.imei')
      .innerJoin(
        Instalaciones,
        'i',
        'i.idDispositivo = d.id AND i.estatus = :instActivo',
        { instActivo: EstatusEnum.ACTIVO },
      )
      .select([
        'up.id AS id',
        'CAST(up.imei AS CHAR) AS imei',
        'up.lat AS lat',
        'up.lng AS lng',
        'up.estado AS estado',
        'up.fechaHora AS fechaHora',
        'up.velocidad AS velocidad',
        'up.direccion AS direccion',
        'up.odometro AS odometro',
        'up.ignicion AS ignicion',
        'up.alarma1 AS alarma1',
        'up.alarma2 AS alarma2',
        'up.energia AS energia',
        'up.idEvento AS idEvento',
        'up.idFoto AS idFoto',
        'up.fhRegistro AS fhRegistro',
        'up.bateria AS bateria',
        'up.alimentacion AS alimentacion',
        'up.gps AS gps',
        'up.gsm AS gsm',
        'up.movimiento AS movimiento',
        'up.combustible AS combustible',
        'up.idFoto1 AS idFoto1',
        'up.idFoto2 AS idFoto2',
        'up.idFoto3 AS idFoto3',
        'up.idVideo1 AS idVideo1',
        'up.idVideo2 AS idVideo2',
        'up.idVideo3 AS idVideo3',
        'i.id AS idInstalacion',
        'i.idCliente AS idCliente',
        'd.id AS idDispositivo',
      ]);
  }

  private mapConsolaUltimaPosicion(
    row: Record<string, unknown>,
  ): ConsolaUltimaPosicionItem {
    return {
      id: Number(row.id),
      imei: imeiToString(row.imei),
      lat: Number(row.lat),
      lng: Number(row.lng),
      estado: num(row.estado),
      fechaHora: formatFechaPosicion(
        row.fechaHora as string | Date | null | undefined,
      ),
      velocidad: num(row.velocidad),
      direccion: num(row.direccion),
      odometro: num(row.odometro),
      ignicion: num(row.ignicion),
      alarma1: num(row.alarma1),
      alarma2: num(row.alarma2),
      energia: num(row.energia),
      idEvento: num(row.idEvento),
      idFoto: num(row.idFoto),
      fhRegistro: formatFechaPosicion(
        row.fhRegistro as string | Date | null | undefined,
      ),
      bateria: num(row.bateria),
      alimentacion: num(row.alimentacion),
      gps: num(row.gps),
      gsm: num(row.gsm),
      movimiento: num(row.movimiento),
      combustible: num(row.combustible),
      idFoto1: num(row.idFoto1),
      idFoto2: num(row.idFoto2),
      idFoto3: num(row.idFoto3),
      idVideo1: num(row.idVideo1),
      idVideo2: num(row.idVideo2),
      idVideo3: num(row.idVideo3),
      idInstalacion: num(row.idInstalacion),
      idCliente: num(row.idCliente),
      idDispositivo: num(row.idDispositivo),
    };
  }

  /**
   * Proxy a springTrackCam POST /gateway/photo/start.
   * Persistencia de Fotos/Posiciones: vía AMQP `jt808.position` (no duplicar aquí).
   */
  async capturarFoto(
    idInstalacion: number,
    accessToken: string,
    channelId?: number,
  ): Promise<TrackcamGatewayPhotoResponse> {
    const device = await this.resolveTrackcamDevice(idInstalacion);
    return this.trackcamGateway.startPhoto({
      accessToken,
      terminalId: device.terminalId,
      imei: device.imei,
      channelId,
    });
  }

  /**
   * Proxy a springTrackCam POST /gateway/video/capture.
   * Persistencia de Videos/Posiciones: vía AMQP `jt808.position` (no duplicar aquí).
   */
  async capturarVideo(
    idInstalacion: number,
    accessToken: string,
    opts?: { durationSeconds?: number; channelId?: number },
  ): Promise<TrackcamGatewayVideoResponse> {
    const device = await this.resolveTrackcamDevice(idInstalacion);
    return this.trackcamGateway.captureVideo({
      accessToken,
      terminalId: device.terminalId,
      imei: device.imei,
      durationSeconds: opts?.durationSeconds,
      channelId: opts?.channelId,
    });
  }

  private async resolveTrackcamDevice(
    idInstalacion: number,
  ): Promise<TrackcamInstalacionDevice> {
    const row = await this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin('i.idDispositivo2', 'd')
      .select([
        'i.id AS idInstalacion',
        'd.id AS idDispositivo',
        'CAST(d.imei AS CHAR) AS imei',
        'd.numeroSerie AS numeroSerie',
        'd.idTipoDispositivo AS idTipoDispositivo',
      ])
      .where('i.id = :idInstalacion', { idInstalacion })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .getRawOne<Record<string, unknown>>();

    if (!row) {
      throw new NotFoundException(
        'Instalación no encontrada o sin dispositivo asignado',
      );
    }

    const tipoTrackcam = await obtenerTipoTrackcam(
      this.instalacionesRepo.manager,
    );
    const idTipo = Number(row.idTipoDispositivo);
    const esTrackcam =
      idTipo === Number(tipoTrackcam.id) ||
      idTipo === EnumTipoDispositivo.TRACKCAM;

    if (!esTrackcam) {
      throw new BadRequestException(
        `La instalación no tiene dispositivo TRACKCAM (IdTipoDispositivo=${idTipo}; se espera ${tipoTrackcam.id} / codigo TRACKCAM)`,
      );
    }

    const numeroSerie = String(row.numeroSerie ?? '').trim();
    if (!numeroSerie) {
      throw new BadRequestException(
        'El dispositivo TRACKCAM no tiene NumeroSerie (terminalId JT808)',
      );
    }

    const imei = imeiToString(row.imei);
    if (!imei) {
      throw new BadRequestException(
        'El dispositivo TRACKCAM no tiene IMEI válido',
      );
    }

    return {
      idInstalacion: Number(row.idInstalacion),
      idDispositivo: Number(row.idDispositivo),
      terminalId: toJt808TerminalId(numeroSerie),
      imei,
    };
  }

  async listado(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<MonitoreoListadoResponse> {
    try {
      const puntosInteres = await this.listarPuntosInteresVisibles(
        idClienteToken,
        rol,
      );

      const qb = this.createListadoQueryBuilder();
      const visible = await this.applyVisibilidadInstalaciones(
        qb,
        idUsuario,
        idClienteToken,
        rol,
      );
      if (!visible) {
        return { posicion: [], 'puntos-interes': puntosInteres };
      }

      qb.orderBy(
        'COALESCE(up.fechaHora, uea.recibidoEn, pa.ultimoHeartbeat)',
        'DESC',
      ).addOrderBy('i.id', 'ASC');

      const rows = await qb.getRawMany<Record<string, unknown>>();

      return {
        posicion: rows.map((row) => mapMonitoreoPosicionItem(row)),
        'puntos-interes': puntosInteres,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener listado de monitoreo',
        error: (error as Error)?.message,
      });
    }
  }

  /**
   * Instalaciones activas del cliente asignadas (UsuariosInstalaciones) a los usuarios dados.
   * Mismo mapeo plano que GET /monitoreo/list → `posicion[]` (sin JSON anidados).
   */
  async listadoPorUsuarios(
    idCliente: number,
    idUsuarios: number[],
    idClienteToken: number,
    rol: number,
  ): Promise<MonitoreoInstalacionesUsuariosResponse> {
    try {
      const idsUsuarios = [
        ...new Set(idUsuarios.map(Number).filter((n) => n > 0)),
      ];
      if (idsUsuarios.length === 0) {
        throw new BadRequestException(
          'idUsuarios debe incluir al menos un ID válido',
        );
      }

      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
        throw new ForbiddenException('Cliente fuera de alcance');
      }

      const usuariosOk = await this.usuariosRepo.count({
        where: {
          id: In(idsUsuarios),
          idCliente,
        },
      });
      if (usuariosOk !== idsUsuarios.length) {
        throw new BadRequestException(
          'Uno o más usuarios no existen o no pertenecen al cliente indicado',
        );
      }

      const idRows = await this.instalacionesRepo
        .createQueryBuilder('i')
        .innerJoin(
          UsuariosInstalaciones,
          'ui',
          'ui.idInstalacion = i.id AND ui.idUsuario IN (:...idsUsuarios) AND ui.estatus = :uiActivo',
          { idsUsuarios, uiActivo: EstatusEnum.ACTIVO },
        )
        .select('DISTINCT i.id', 'id')
        .where('i.idCliente = :idCliente', { idCliente })
        .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
        .getRawMany<{ id: string | number }>();

      const idsInstalacion = [
        ...new Set(
          idRows
            .map((r) => Number(r.id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];
      if (idsInstalacion.length === 0) {
        return { posicion: [] };
      }

      const qb = this.createListadoQueryBuilder();
      qb.andWhere('i.id IN (:...idsInstalacion)', { idsInstalacion })
        .orderBy(
          'COALESCE(up.fechaHora, uea.recibidoEn, pa.ultimoHeartbeat)',
          'DESC',
        )
        .addOrderBy('i.id', 'ASC');

      const rows = await qb.getRawMany<Record<string, unknown>>();

      return {
        posicion: rows.map((row) => mapMonitoreoPosicionItem(row)),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener instalaciones por usuarios',
        error: (error as Error)?.message,
      });
    }
  }

  /** Puntos de interés activos con el mismo alcance tenant que el módulo Puntos. */
  private async listarPuntosInteresVisibles(
    idClienteToken: number,
    rol: number,
  ): Promise<ReturnType<typeof mapPuntoInteresPlano>[]> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return [];
    }

    const where: FindOptionsWhere<PuntosInteres> = {
      estatus: EstatusEnum.ACTIVO,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    const rows = await this.puntosInteresRepo.find({
      where,
      relations: [...RELACIONES_PUNTO_INTERES],
      order: { id: 'ASC' },
    });

    return rows.map((item) => mapPuntoInteresPlano(item));
  }

  /**
   * Histórico de posiciones por instalación + rango de fechas.
   * Resuelve IMEI del dispositivo y lee `Posiciones` (sin filtro por cliente).
   */
  async reporteHistorico(
    idInstalacion: number,
    fechaInicioRaw: string,
    fechaFinalRaw: string,
  ): Promise<HistoricoMonitoreoResponse> {
    try {
      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(fechaInicioRaw);
        fechaFinal = parseFechaHistorico(fechaFinalRaw);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }

      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const ctxRow = await this.cargarContextoInstalacion(idInstalacion);
      if (!ctxRow) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const idTipoProducto = Number(ctxRow.idTipoProducto);
      if (idTipoProducto === EnumTipoProducto.INMUEBLE) {
        throw new BadRequestException(
          'El histórico GPS no aplica a inmuebles / paneles',
        );
      }

      const imei = imeiToString(ctxRow.imei);
      if (!imei) {
        throw new BadRequestException(
          'La instalación no tiene un dispositivo con IMEI asignado',
        );
      }

      const ctx = mapContextoDesdeRow(ctxRow);

      const posicionesRows = await this.posicionesRepo
        .createQueryBuilder('p')
        .leftJoin(Fotos, 'f0', 'f0.id = p.idFoto')
        .leftJoin(Fotos, 'f1', 'f1.id = p.idFoto1')
        .leftJoin(Fotos, 'f2', 'f2.id = p.idFoto2')
        .leftJoin(Fotos, 'f3', 'f3.id = p.idFoto3')
        .leftJoin(Videos, 'vid1', 'vid1.id = p.idVideo1')
        .leftJoin(Videos, 'vid2', 'vid2.id = p.idVideo2')
        .leftJoin(Videos, 'vid3', 'vid3.id = p.idVideo3')
        .select([
          'p.id AS id',
          'CAST(p.imei AS CHAR) AS imei',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.estado AS estado',
          `DATE_FORMAT(p.fechaHora, '%Y-%m-%dT%H:%i:%s') AS fecha`,
          'p.fechaHora AS fechaHora',
          'p.velocidad AS velocidad',
          'p.direccion AS direccion',
          'p.odometro AS odometro',
          'p.ignicion AS ignicion',
          'p.alarma1 AS alarma1',
          'p.alarma2 AS alarma2',
          'p.energia AS energia',
          'p.idEvento AS idEvento',
          'p.idFoto AS idFoto',
          'p.fhRegistro AS fhRegistro',
          'p.bateria AS bateria',
          'p.alimentacion AS alimentacion',
          'p.gps AS gps',
          'p.gsm AS gsm',
          'p.movimiento AS movimiento',
          'p.combustible AS combustible',
          'p.idFoto1 AS idFoto1',
          'p.idFoto2 AS idFoto2',
          'p.idFoto3 AS idFoto3',
          'p.idVideo1 AS idVideo1',
          'p.idVideo2 AS idVideo2',
          'p.idVideo3 AS idVideo3',
          'f0.ruta AS rutaFoto',
          'f1.ruta AS rutaFoto1',
          'f2.ruta AS rutaFoto2',
          'f3.ruta AS rutaFoto3',
          'vid1.ruta AS rutaVideo1',
          'vid2.ruta AS rutaVideo2',
          'vid3.ruta AS rutaVideo3',
        ])
        .where('p.imei = :imei', { imei })
        .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
        .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
        .orderBy('p.fechaHora', 'DESC')
        .addOrderBy('p.id', 'DESC')
        .getRawMany<Record<string, unknown>>();

      const distancia = calcularDistanciaHistoricoMonitoreo(
        posicionesRows.map((row) => ({
          id: Number(row.id),
          lat: Number(row.lat),
          lng: Number(row.lng),
          fechaHora: row.fechaHora as Date | string,
        })),
        { yaOrdenadoDesc: true },
      );

      const posiciones = posicionesRows.map((row) => {
        const item = mapHistoricoPosicionItem(row, ctx);
        item.totalDistancia =
          distancia.acumuladoKmPorId.get(item.idPosicion!) ?? null;
        return item;
      });

      return {
        totalDistancia: distancia.totalDistanciaKm,
        posiciones,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener histórico de posiciones',
        error: (error as Error)?.message,
      });
    }
  }

  async idsInstalacionesVisibles(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<number[]> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .select('i.id', 'id')
      .where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO });

    const visible = await this.applyVisibilidadInstalaciones(
      qb,
      idUsuario,
      idClienteToken,
      rol,
    );
    if (!visible) {
      return [];
    }

    const rows = await qb.getRawMany<{ id: string | number }>();
    return rows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id));
  }

  async obtenerPorInstalacion(
    idInstalacion: number,
  ): Promise<MonitoreoPosicionItem | null> {
    const qb = this.createListadoQueryBuilder();
    qb.andWhere('i.id = :idInstalacion', { idInstalacion });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? mapMonitoreoPosicionItem(row) : null;
  }

  async obtenerPorDispositivo(
    idDispositivo: number,
  ): Promise<MonitoreoPosicionItem | null> {
    const qb = this.createListadoQueryBuilder();
    qb.andWhere('d.id = :idDispositivo', { idDispositivo });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? mapMonitoreoPosicionItem(row) : null;
  }

  async obtenerPorImei(imei: string): Promise<MonitoreoPosicionItem | null> {
    const qb = this.createListadoQueryBuilder();
    qb.andWhere('d.imei = :imei', { imei });
    const row = await qb.getRawOne<Record<string, unknown>>();
    return row ? mapMonitoreoPosicionItem(row) : null;
  }

  private async cargarContextoInstalacion(
    idInstalacion: number,
  ): Promise<Record<string, unknown> | null> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin('i.idCliente2', 'c')
      .innerJoin('i.idProducto2', 'p')
      .leftJoin('i.idDispositivo2', 'd')
      .leftJoin(CatTipoDispositivo, 'td', 'td.id = d.idTipoDispositivo')
      .leftJoin('d.idMarca2', 'marDisp')
      .leftJoin('d.idModelo2', 'modDisp')
      .leftJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
      .leftJoin(CatMarcas, 'marVeh', 'marVeh.id = v.idMarcaVehiculo')
      .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
      .leftJoin(
        Activos,
        'a',
        'a.idProducto = i.idProducto AND a.idCliente = i.idCliente',
      )
      .leftJoin(
        Personas,
        'per',
        'per.idProducto = i.idProducto AND per.idCliente = i.idCliente',
      )
      .select([
        'i.id AS idInstalacion',
        'i.idCliente AS idCliente',
        'i.idProducto AS idProducto',
        'p.idTipoProducto AS idTipoProducto',
        'p.nombre AS nombreProducto',
        'p.estatus AS estatusProducto',
        'CAST(d.imei AS CHAR) AS imei',
        'd.eco AS ecoDispositivo',
        'd.numeroSerie AS numeroSerieDispositivo',
        'd.idTipoDispositivo AS idTipoDispositivo',
        'td.codigo AS codigoTipoDispositivo',
        'td.nombre AS nombreTipoDispositivo',
        'marDisp.nombre AS marcaDispositivo',
        'modDisp.nombre AS modeloDispositivo',
        'v.anio AS anio',
        'v.placa AS placas',
        'v.numeroEconomico AS economico',
        'v.numeroSerie AS numeroSerieProducto',
        'v.color AS color',
        'v.foto AS imagen',
        'marVeh.nombre AS marca',
        'modVeh.nombre AS modelo',
        'COALESCE(a.descripcion, a.nombre, per.nombre, p.nombre) AS descripcion',
        "CONCAT_WS(' ', c.nombre, c.apellidoPaterno, c.apellidoMaterno) AS nombreCompletoCliente",
      ])
      .where('i.id = :idInstalacion', { idInstalacion })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO });

    return (await qb.getRawOne<Record<string, unknown>>()) ?? null;
  }

  private createListadoQueryBuilder(): SelectQueryBuilder<Instalaciones> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO });

    applyMonitoreoListJoins(qb);
    applyMonitoreoListSelect(qb);
    return qb;
  }

  private async applyVisibilidadInstalaciones(
    qb: SelectQueryBuilder<Instalaciones>,
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<boolean> {
    const rolNum = Number(rol);

    if (
      rolNum === EnumRoles.OPERADOR ||
      rolNum === EnumRoles.USUARIO
    ) {
      qb.innerJoin(
        UsuariosInstalaciones,
        'ui',
        'ui.idInstalacion = i.id AND ui.idUsuario = :idUsuario AND ui.estatus = :uiActivo',
        { idUsuario, uiActivo: EstatusEnum.ACTIVO },
      );
      return true;
    }

    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return false;
    }

    if (tenant.idCliente !== undefined) {
      if (typeof tenant.idCliente === 'number') {
        qb.andWhere('i.idCliente = :idCliente', {
          idCliente: tenant.idCliente,
        });
      } else {
        const ids = this.extractInValues(tenant.idCliente);
        if (ids.length === 0) {
          return false;
        }
        qb.andWhere('i.idCliente IN (:...idsCliente)', {
          idsCliente: ids,
        });
      }
    }

    return true;
  }

  private extractInValues(op: ReturnType<typeof In>): number[] {
    const anyOp = op as unknown as { value?: unknown };
    const raw = anyOp.value;
    if (Array.isArray(raw)) {
      return raw.map(Number).filter((id) => Number.isFinite(id));
    }
    return [];
  }
}

/** NumeroSerie JT808 → terminalId de 12 dígitos. */
function toJt808TerminalId(numeroSerie: string): string {
  const s = numeroSerie.trim();
  if (/^\d+$/.test(s) && s.length <= 12) {
    return s.padStart(12, '0');
  }
  return s;
}

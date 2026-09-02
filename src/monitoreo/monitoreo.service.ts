import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumRoles, EstatusEnum } from 'src/common/estatus.enum';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { Activos } from 'src/entities/Activos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Personas } from 'src/entities/Personas';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import {
  applyMonitoreoListJoins,
  applyMonitoreoListSelect,
} from './helpers/monitoreo-sql.helpers';
import {
  calcularDistanciaHistoricoMonitoreo,
} from './helpers/monitoreo-distancia.helpers';
import { resolveUmbralesDistanciaHistorico } from './helpers/monitoreo-distancia.config';
import {
  mapContextoDesdeRow,
  mapHistoricoPosicionItem,
  parseFechaHistorico,
  HistoricoMonitoreoResponse,
} from './helpers/monitoreo-historico.helpers';
import {
  mapMonitoreoPosicionItem,
  MonitoreoPosicionItem,
  num,
} from './monitoreo.mapper';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    private readonly tenantFilter: TenantFilterService,
    private readonly config: ConfigService,
  ) { }

  async listado(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ posicion: MonitoreoPosicionItem[] }> {
    try {
      const qb = this.createListadoQueryBuilder();
      const visible = await this.applyVisibilidadInstalaciones(
        qb,
        idUsuario,
        idClienteToken,
        rol,
      );
      if (!visible) {
        return { posicion: [] };
      }

      qb.orderBy(
        'COALESCE(up.fechaHora, uea.recibidoEn, pa.ultimoHeartbeat)',
        'DESC',
      ).addOrderBy('i.id', 'ASC');

      const rows = await qb.getRawMany<Record<string, unknown>>();

      return {
        posicion: rows.map((row) => mapMonitoreoPosicionItem(row)),
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
   * Histórico de posiciones por instalación + rango de fechas.
   * Resuelve IMEI del dispositivo y lee `Posiciones` (sin filtro por cliente).
   */
  async reporteHistorico(
    idInstalacion: number,
    fechaInicioRaw: string,
    fechaFinalRaw: string,
  ): Promise<HistoricoMonitoreoResponse> {
    try {
      let fechaInicio: Date;
      let fechaFinal: Date;
      try {
        fechaInicio = parseFechaHistorico(fechaInicioRaw);
        fechaFinal = parseFechaHistorico(fechaFinalRaw);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }

      if (fechaInicio.getTime() > fechaFinal.getTime()) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const ctxRow = await this.cargarContextoInstalacion(idInstalacion);
      if (!ctxRow) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const imei = Number(ctxRow.imei);
      if (!Number.isFinite(imei) || imei <= 0) {
        throw new BadRequestException(
          'La instalación no tiene un dispositivo con IMEI asignado',
        );
      }

      const ctx = mapContextoDesdeRow(ctxRow);

      const posicionesRows = await this.posicionesRepo
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.imei AS imei',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.estado AS estado',
          'p.fechaHora AS fechaHora',
          'p.velocidad AS velocidad',
          'p.direccion AS direccion',
          'p.odometro AS odometro',
          'p.ignicion AS ignicion',
          'p.movimiento AS movimiento',
          'p.combustible AS combustible',
        ])
        .where('p.imei = :imei', { imei })
        .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
        .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
        .orderBy('p.fechaHora', 'DESC')
        .addOrderBy('p.id', 'DESC')
        .getRawMany<Record<string, unknown>>();

      const umbrales = resolveUmbralesDistanciaHistorico(this.config);

      const distancia = calcularDistanciaHistoricoMonitoreo(
        posicionesRows.map((row) => ({
          id: Number(row.id),
          lat: Number(row.lat),
          lng: Number(row.lng),
          fechaHora: row.fechaHora as Date | string,
          movimiento: num(row.movimiento),
          velocidad: num(row.velocidad),
        })),
        { yaOrdenadoDesc: true, umbrales },
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

  async obtenerPorImei(imei: number): Promise<MonitoreoPosicionItem | null> {
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
        'p.nombre AS nombreProducto',
        'p.estatus AS estatusProducto',
        'd.imei AS imei',
        'd.eco AS ecoDispositivo',
        'd.numeroSerie AS numeroSerieDispositivo',
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

import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumRoles, EstatusEnum } from 'src/common/estatus.enum';
import { Instalaciones } from 'src/entities/Instalaciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import {
  applyMonitoreoListJoins,
  applyMonitoreoListSelect,
} from './helpers/monitoreo-sql.helpers';
import {
  mapMonitoreoPosicionItem,
  MonitoreoPosicionItem,
} from './monitoreo.mapper';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    private readonly tenantFilter: TenantFilterService,
  ) {}

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

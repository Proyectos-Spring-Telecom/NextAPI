import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumRoles, EstatusEnum } from 'src/common/estatus.enum';
import { Instalaciones } from 'src/entities/Instalaciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import {
  applyMonitoreoListJoins,
  applyMonitoreoListSelect,
} from './helpers/monitoreo-sql.helpers';
import { mapMonitoreoPosicionItem } from './monitoreo.mapper';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  async listado(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ posicion: ReturnType<typeof mapMonitoreoPosicionItem>[] }> {
    try {
      const rolNum = Number(rol);
      const qb = this.instalacionesRepo
        .createQueryBuilder('i')
        .where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO });

      applyMonitoreoListJoins(qb);
      applyMonitoreoListSelect(qb);

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
      } else {
        const tenant = await this.tenantFilter.forTypeOrmIdCliente(
          rol,
          idClienteToken,
        );
        if (tenant.sinAcceso) {
          return { posicion: [] };
        }
        if (tenant.idCliente !== undefined) {
          if (typeof tenant.idCliente === 'number') {
            qb.andWhere('i.idCliente = :idCliente', {
              idCliente: tenant.idCliente,
            });
          } else {
            const ids = this.extractInValues(tenant.idCliente);
            if (ids.length === 0) {
              return { posicion: [] };
            }
            qb.andWhere('i.idCliente IN (:...idsCliente)', {
              idsCliente: ids,
            });
          }
        }
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

  private extractInValues(op: ReturnType<typeof In>): number[] {
    const anyOp = op as unknown as { value?: unknown };
    const raw = anyOp.value;
    if (Array.isArray(raw)) {
      return raw.map(Number).filter((id) => Number.isFinite(id));
    }
    return [];
  }

}

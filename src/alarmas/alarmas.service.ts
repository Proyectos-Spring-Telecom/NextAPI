import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import {
  isTenantForbidden,
  TenantFilterService,
} from 'src/common/tenant-filter/tenant-filter.service';
import { FilterEventosDto } from './dto/filter-eventos.dto';
import {
  calcularOnline,
  mapEventoItem,
  mapInmuebleCompleto,
  mapInmuebleCorto,
  mapUltimoEvento,
  nombreClientePartes,
  num,
  toIso,
} from './alarmas-mapper';

const SQL_PANELES_BASE = `
SELECT p.IdDispositivo, p.CuentaSia, p.Nombre, p.IdCliente, p.UltimoHeartbeat, p.Estatus,
       c.Id AS ClienteId, c.Nombre AS ClienteNombre,
       c.ApellidoPaterno AS ClienteApellidoPaterno,
       c.ApellidoMaterno AS ClienteApellidoMaterno,
       i.IdProducto, i.Inmueble, i.DireccionFiscal,
       i.NombreRepresentante, i.TelefonoRepresentante, i.CorreoRepresentante,
       i.Lat, i.Lng
  FROM PanelAlarma p
  LEFT JOIN Clientes c ON c.Id = p.IdCliente
  LEFT JOIN Instalaciones inst
         ON inst.IdDispositivo = p.IdDispositivo
        AND inst.IdCliente = p.IdCliente
        AND inst.Estatus = 1
  LEFT JOIN Inmuebles i
         ON i.IdProducto = inst.IdProducto
        AND i.IdCliente = inst.IdCliente
 WHERE p.Estatus = 1
`;

const SQL_EVENTO_JOINS = `
SELECT e.Id, e.IdPanel, e.IdCliente, e.CodigoSia, e.TipoEvento, e.EsRestauracion,
       e.Zona, e.CodigoUsuario, e.NombreDispositivo, e.Severidad, e.RecibidoEn,
       p.IdDispositivo AS PanelId, p.CuentaSia, p.Nombre AS PanelNombre,
       i.IdProducto, i.Inmueble, i.Lat, i.Lng
  FROM EventoAlarma e
  LEFT JOIN PanelAlarma p ON p.IdDispositivo = e.IdPanel
  LEFT JOIN Instalaciones inst
         ON inst.IdDispositivo = e.IdPanel
        AND inst.IdCliente = e.IdCliente
        AND inst.Estatus = 1
  LEFT JOIN Inmuebles i
         ON i.IdProducto = inst.IdProducto
        AND i.IdCliente = inst.IdCliente
 WHERE e.Estatus = 1
`;

@Injectable()
export class AlarmasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly config: ConfigService,
  ) {}

  async findPaneles(
    rol: number,
    idClienteToken: number,
    queryIdCliente?: number,
  ) {
    const { sql, params } = await this.filtroTenant(
      rol,
      idClienteToken,
      queryIdCliente,
      'p',
    );
    const rows = await this.dataSource.query(
      `${SQL_PANELES_BASE} ${sql} ORDER BY p.Nombre ASC`,
      params,
    );
    const threshold = this.thresholdMs();
    return (rows as any[]).map((row) => this.mapPanelCompleto(row, threshold));
  }

  async findPanelById(
    id: number,
    rol: number,
    idClienteToken: number,
  ) {
    const rows = await this.dataSource.query(
      `${SQL_PANELES_BASE} AND p.IdDispositivo = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) {
      throw new NotFoundException('Panel no encontrado');
    }
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, num(row.IdCliente))) {
      throw new ForbiddenException('No tiene acceso a este panel');
    }
    return this.mapPanelCompleto(row, this.thresholdMs());
  }

  async findUltimosEventos(
    rol: number,
    idClienteToken: number,
    queryIdCliente?: number,
  ) {
    const { sql, params } = await this.filtroTenant(
      rol,
      idClienteToken,
      queryIdCliente,
      'p',
    );
    const paneles = await this.dataSource.query(
      `${SQL_PANELES_BASE} ${sql} ORDER BY p.Nombre ASC`,
      params,
    );
    const ids = (paneles as any[])
      .map((p) => num(p.IdDispositivo))
      .filter((id): id is number => id != null);

    const ultimosPorPanel = new Map<number, any>();
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      const ultimos = await this.dataSource.query(
        `SELECT * FROM UltimoEventoAlarma WHERE IdPanel IN (${placeholders})`,
        ids,
      );
      for (const u of ultimos as any[]) {
        const idPanel = num(u.IdPanel);
        if (idPanel != null) {
          ultimosPorPanel.set(idPanel, u);
        }
      }
    }

    const threshold = this.thresholdMs();
    return (paneles as any[]).map((row) => {
      const idPanel = num(row.IdDispositivo) as number;
      const ultimo = ultimosPorPanel.get(idPanel);
      return {
        panel: {
          id: idPanel,
          cuentaSia: row.CuentaSia,
          nombre: row.Nombre,
          idCliente: num(row.IdCliente),
          idInmueble: num(row.IdProducto),
          ultimoHeartbeat: toIso(row.UltimoHeartbeat),
          online: calcularOnline(row.UltimoHeartbeat, threshold),
          estatus: Number(row.Estatus),
          cliente: {
            id: num(row.ClienteId),
            nombre: nombreClientePartes(
              row.ClienteNombre,
              row.ClienteApellidoPaterno,
              row.ClienteApellidoMaterno,
            ),
          },
          inmueble: mapInmuebleCorto(row),
        },
        ultimoEvento: mapUltimoEvento(ultimo ?? null),
      };
    });
  }

  async findEventos(
    rol: number,
    idClienteToken: number,
    query: FilterEventosDto,
  ): Promise<ApiResponseCommon> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { sql, params } = await this.filtroTenant(
      rol,
      idClienteToken,
      query.idCliente,
      'e',
    );

    const extra: string[] = [];
    const extraParams: unknown[] = [];
    if (query.idPanel != null) {
      extra.push(' AND e.IdPanel = ? ');
      extraParams.push(query.idPanel);
    }
    if (query.codigoSia) {
      extra.push(' AND e.CodigoSia = ? ');
      extraParams.push(query.codigoSia.toUpperCase());
    }
    if (query.desde) {
      extra.push(' AND e.RecibidoEn >= ? ');
      extraParams.push(new Date(query.desde));
    }
    if (query.hasta) {
      extra.push(' AND e.RecibidoEn <= ? ');
      extraParams.push(new Date(query.hasta));
    }

    const where = `${sql}${extra.join('')}`;
    const allParams = [...params, ...extraParams];

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM EventoAlarma e WHERE e.Estatus = 1 ${where}`,
      allParams,
    );
    const total = Number(countRows?.[0]?.total ?? 0);
    const offset = (page - 1) * limit;

    const rows = await this.dataSource.query(
      `${SQL_EVENTO_JOINS} ${where} ORDER BY e.RecibidoEn DESC LIMIT ? OFFSET ?`,
      [...allParams, limit, offset],
    );

    return {
      data: (rows as any[]).map((row) => mapEventoItem(row)),
      paginated: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findEventoById(id: number, rol: number, idClienteToken: number) {
    const rows = await this.dataSource.query(
      `${SQL_EVENTO_JOINS} AND e.Id = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) {
      throw new NotFoundException('Evento no encontrado');
    }
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, num(row.IdCliente))) {
      throw new ForbiddenException('No tiene acceso a este evento');
    }
    return mapEventoItem(row);
  }

  private async filtroTenant(
    rol: number,
    idClienteToken: number,
    queryIdCliente: number | undefined,
    alias: string,
  ) {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    const filtro = this.tenantFilter.aplicarFiltroListado(
      scope,
      queryIdCliente,
      alias,
    );
    if (isTenantForbidden(filtro)) {
      throw new ForbiddenException('No tiene acceso al cliente solicitado');
    }
    return filtro;
  }

  private thresholdMs(): number {
    return Number(this.config.get<number>('SIA_OFFLINE_THRESHOLD_MS') ?? 600_000);
  }

  private mapPanelCompleto(row: any, threshold: number) {
    return {
      id: num(row.IdDispositivo),
      cuentaSia: row.CuentaSia,
      nombre: row.Nombre,
      idCliente: num(row.IdCliente),
      idInmueble: num(row.IdProducto),
      ultimoHeartbeat: toIso(row.UltimoHeartbeat),
      online: calcularOnline(row.UltimoHeartbeat, threshold),
      estatus: Number(row.Estatus),
      cliente: {
        id: num(row.ClienteId),
        nombre: nombreClientePartes(
          row.ClienteNombre,
          row.ClienteApellidoPaterno,
          row.ClienteApellidoMaterno,
        ),
      },
      inmueble: mapInmuebleCompleto(row),
    };
  }
}

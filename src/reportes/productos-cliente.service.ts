import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumRoles,
  EnumTipoDispositivo,
  EnumTipoProducto,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import { formatFechaPosicion } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { calcularOnline } from 'src/alarmas/alarmas-mapper';
import { ProductosClienteDto } from './dto/productos-cliente.dto';

export type TipoProductoCliente =
  | 'vehiculo'
  | 'activo'
  | 'inmueble'
  | 'persona'
  | 'panel'
  | 'otro';

/** Fila plana del reporte: producto instalado + su última ubicación conocida. */
export type ProductoClienteItem = {
  idInstalacion: number;
  idProducto: number | null;
  tipo: TipoProductoCliente;
  idTipoProducto: number | null;
  nombreTipoProducto: string | null;
  nombreProducto: string | null;

  idDispositivo: number | null;
  idTipoDispositivo: number | null;
  nombreTipoDispositivo: string | null;
  imei: string | null;
  numeroSerie: string | null;

  placas: string | null;
  economico: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  nombreActivo: string | null;
  inmueble: string | null;
  direccionInmueble: string | null;
  nombrePersona: string | null;
  telefonoPersona: string | null;

  /** Solo paneles de alarma. */
  cuentaSia: string | null;
  nombrePanel: string | null;
  panelEnLinea: boolean | null;
  ultimoHeartbeat: string | null;
  ultimoEventoTipo: string | null;
  ultimoEventoCodigo: string | null;
  ultimoEventoZona: number | null;
  ultimoEventoRestauracion: boolean | null;
  ultimoEventoFecha: string | null;

  /** Coordenadas para el modal (no se muestran en el grid). */
  lat: number | null;
  lng: number | null;
  /** `posicion` = UltimaPosicion del IMEI; `inmueble` = coordenadas del inmueble. */
  origenUbicacion: 'posicion' | 'inmueble' | null;
  estado: number | null;
  velocidad: number | null;
  ignicion: number | null;
  fechaHora: string | null;

  /** Usuarios del cliente que tienen asignado el producto. */
  idsUsuario: number[];
  usuarios: string | null;
};

export type ProductosClienteResult = {
  idCliente: number;
  total: number;
  productos: ProductoClienteItem[];
};

const SQL_PRODUCTOS_CLIENTE = `
SELECT inst.Id AS idInstalacion,
       prod.Id AS idProducto, prod.Nombre AS nombreProducto,
       prod.IdTipoProducto AS idTipoProducto, tp.Nombre AS nombreTipoProducto,
       d.Id AS idDispositivo, CAST(d.Imei AS CHAR) AS imei, d.NumeroSerie AS numeroSerie,
       d.IdTipoDispositivo AS idTipoDispositivo, td.Nombre AS nombreTipoDispositivo,
       v.Placa AS placas, v.NumeroEconomico AS economico,
       mar.Nombre AS marca, mdl.Nombre AS modelo, v.Anio AS anio,
       a.Nombre AS nombreActivo,
       inm.Inmueble AS inmueble, inm.DireccionFiscal AS direccionInmueble,
       inm.Lat AS latInmueble, inm.Lng AS lngInmueble,
       per.Nombre AS nombrePersona, per.Telefono AS telefonoPersona,
       p.IdDispositivo AS idPanel, p.CuentaSia AS cuentaSia, p.Nombre AS nombrePanel,
       p.UltimoHeartbeat AS ultimoHeartbeat
  FROM Instalaciones inst
  LEFT JOIN Productos prod ON prod.Id = inst.IdProducto AND prod.IdCliente = inst.IdCliente
  LEFT JOIN CatTipoProducto tp ON tp.Id = prod.IdTipoProducto
  LEFT JOIN Dispositivos d ON d.Id = inst.IdDispositivo AND d.IdCliente = inst.IdCliente
  LEFT JOIN CatTipoDispositivo td ON td.Id = d.IdTipoDispositivo
  LEFT JOIN Vehiculos v ON v.IdProducto = inst.IdProducto AND v.IdCliente = inst.IdCliente
  LEFT JOIN CatMarcas mar ON mar.Id = v.IdMarcaVehiculo
  LEFT JOIN CatModelos mdl ON mdl.Id = v.IdModeloVehiculo
  LEFT JOIN Activos a ON a.IdProducto = inst.IdProducto AND a.IdCliente = inst.IdCliente
  LEFT JOIN Inmuebles inm ON inm.IdProducto = inst.IdProducto AND inm.IdCliente = inst.IdCliente
  LEFT JOIN Personas per ON per.IdProducto = inst.IdProducto AND per.IdCliente = inst.IdCliente
  LEFT JOIN PanelAlarma p
         ON p.IdDispositivo = inst.IdDispositivo
        AND p.IdCliente = inst.IdCliente
        AND p.Estatus = 1
 WHERE inst.IdCliente = ?
   AND inst.Estatus = 1
`;

/** Productos asignados al usuario (UsuariosInstalaciones). */
const SQL_FILTRO_USUARIOS = `
   AND EXISTS (SELECT 1 FROM UsuariosInstalaciones ui
                WHERE ui.IdInstalacion = inst.Id
                  AND ui.Estatus = 1
                  AND ui.IdUsuario = ?)
`;

/**
 * Reporte "Productos Cliente": todo lo que el cliente tiene instalado
 * (vehículos, activos, inmuebles, personas y paneles de alarma) con su
 * última ubicación. Solo lectura.
 */
@Injectable()
export class ProductosClienteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly config: ConfigService,
  ) {}

  async productosCliente(
    dto: ProductosClienteDto,
    idClienteToken: number,
    idUsuarioToken: number,
    rol: number,
  ): Promise<{ data: ProductosClienteResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
        throw new ForbiddenException(
          'No puedes generar reportes para ese cliente',
        );
      }

      const idUsuario = await this.resolverUsuario(
        idCliente,
        dto.idUsuario,
        rol,
        idUsuarioToken,
      );
      const vacio = { data: { idCliente, total: 0, productos: [] } };
      if (idUsuario === 0) return vacio;

      let sql = SQL_PRODUCTOS_CLIENTE;
      const params: unknown[] = [idCliente];
      if (idUsuario != null) {
        sql += SQL_FILTRO_USUARIOS;
        params.push(idUsuario);
      }
      sql += ' ORDER BY prod.IdTipoProducto ASC, inst.Id ASC';

      const rows = (await this.dataSource.query(sql, params)) as Record<
        string,
        unknown
      >[];
      if (!rows.length) return vacio;

      const [posiciones, eventos, usuarios] = await Promise.all([
        this.ultimasPosiciones(rows),
        this.ultimosEventosPanel(rows),
        this.usuariosAsignados(idCliente, rows),
      ]);
      const umbral = Number(
        this.config.get<number>('SIA_OFFLINE_THRESHOLD_MS') ?? 600_000,
      );

      const productos = rows.map((row) =>
        this.mapFila(row, posiciones, eventos, usuarios, umbral),
      );
      return {
        data: { idCliente, total: productos.length, productos },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * null = sin filtro de usuario; 0 = el usuario no es del cliente (sin resultados).
   * Roles 7/9 solo ven lo asignado a ellos.
   */
  private async resolverUsuario(
    idCliente: number,
    idUsuario: number | undefined,
    rol: number,
    idUsuarioToken: number,
  ): Promise<number | null> {
    const r = Number(rol);
    const asignado = r === EnumRoles.OPERADOR || r === EnumRoles.USUARIO;
    const id = asignado ? Number(idUsuarioToken) : Number(idUsuario);
    if (!Number.isInteger(id) || id < 1) return null;

    const rows = (await this.dataSource.query(
      'SELECT Id FROM Usuarios WHERE IdCliente = ? AND Id = ? LIMIT 1',
      [idCliente, id],
    )) as unknown[];
    return rows.length ? id : 0;
  }

  private async ultimasPosiciones(
    rows: Record<string, unknown>[],
  ): Promise<Map<string, Record<string, unknown>>> {
    const imeis = [
      ...new Set(
        rows
          .filter((r) => !esPanel(r))
          .map((r) => imeiToString(r.imei))
          .filter((imei): imei is string => !!imei),
      ),
    ];
    const mapa = new Map<string, Record<string, unknown>>();
    if (!imeis.length) return mapa;

    const posiciones = (await this.dataSource.query(
      `SELECT CAST(up.Imei AS CHAR) AS imei, up.Lat AS lat, up.Lng AS lng,
              up.Estado AS estado, up.Velocidad AS velocidad,
              up.Ignicion AS ignicion, up.FechaHora AS fechaHora
         FROM UltimaPosicion up
         -- Una última posición anterior a la instalación vigente es de otra
         -- vigencia (docs/motor-activos.md §6): se trata como sin posición.
         JOIN Dispositivos d ON d.Imei = up.Imei
         JOIN Instalaciones i ON i.IdDispositivo = d.Id AND i.Estatus = 1
                             AND up.FechaHora >= i.VigenteDesde
        WHERE up.Imei IN (${marcas(imeis)})`,
      imeis,
    )) as Record<string, unknown>[];
    for (const p of posiciones) {
      const imei = imeiToString(p.imei);
      if (imei) mapa.set(imei, p);
    }
    return mapa;
  }

  /** Último evento recibido por panel (el más reciente si hay varios). */
  private async ultimosEventosPanel(
    rows: Record<string, unknown>[],
  ): Promise<Map<number, Record<string, unknown>>> {
    const ids = [
      ...new Set(
        rows
          .map((r) => num(r.idPanel))
          .filter((id): id is number => id != null),
      ),
    ];
    const mapa = new Map<number, Record<string, unknown>>();
    if (!ids.length) return mapa;

    const eventos = (await this.dataSource.query(
      `SELECT e.IdPanel AS idPanel, e.TipoEvento AS tipoEvento,
              e.CodigoSia AS codigoSia, e.Zona AS zona,
              e.EsRestauracion AS esRestauracion, e.RecibidoEn AS recibidoEn
         FROM UltimoEventoAlarma e
        WHERE e.IdPanel IN (${marcas(ids)})
        ORDER BY e.RecibidoEn DESC`,
      ids,
    )) as Record<string, unknown>[];
    for (const e of eventos) {
      const id = num(e.idPanel);
      if (id != null && !mapa.has(id)) mapa.set(id, e);
    }
    return mapa;
  }

  /** Nombres de usuarios (del cliente) asignados por instalación / panel. */
  private async usuariosAsignados(
    idCliente: number,
    rows: Record<string, unknown>[],
  ): Promise<{
    porInstalacion: Map<number, UsuarioAsignado[]>;
    porPanel: Map<number, UsuarioAsignado[]>;
  }> {
    const porInstalacion = new Map<number, UsuarioAsignado[]>();
    const porPanel = new Map<number, UsuarioAsignado[]>();
    const idsInst = rows.map((r) => Number(r.idInstalacion));

    const nombre = `TRIM(CONCAT_WS(' ', u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno))`;
    const asigInst = idsInst.length
      ? ((await this.dataSource.query(
          `SELECT ui.IdInstalacion AS idRef, u.Id AS id, ${nombre} AS nombre
             FROM UsuariosInstalaciones ui
             JOIN Usuarios u ON u.Id = ui.IdUsuario
            WHERE ui.Estatus = 1 AND u.Estatus = 1 AND u.IdCliente = ?
              AND ui.IdInstalacion IN (${marcas(idsInst)})`,
          [idCliente, ...idsInst],
        )) as Record<string, unknown>[])
      : [];

    const agregar = (
      mapa: Map<number, UsuarioAsignado[]>,
      filas: Record<string, unknown>[],
    ) => {
      for (const f of filas) {
        const ref = Number(f.idRef);
        const lista = mapa.get(ref) ?? [];
        lista.push({ id: Number(f.id), nombre: str(f.nombre) ?? `Usuario #${f.id}` });
        mapa.set(ref, lista);
      }
    };
    agregar(porInstalacion, asigInst);
    return { porInstalacion, porPanel };
  }

  private mapFila(
    row: Record<string, unknown>,
    posiciones: Map<string, Record<string, unknown>>,
    eventos: Map<number, Record<string, unknown>>,
    usuarios: {
      porInstalacion: Map<number, UsuarioAsignado[]>;
      porPanel: Map<number, UsuarioAsignado[]>;
    },
    umbral: number,
  ): ProductoClienteItem {
    const idInstalacion = Number(row.idInstalacion);
    const idPanel = num(row.idPanel);
    const panel = esPanel(row);
    const imei = imeiToString(row.imei);
    const pos = !panel && imei ? posiciones.get(imei) : undefined;
    const evento = idPanel != null ? eventos.get(idPanel) : undefined;

    const latPos = num(pos?.lat);
    const lngPos = num(pos?.lng);
    const latInm = num(row.latInmueble);
    const lngInm = num(row.lngInmueble);
    let lat: number | null = null;
    let lng: number | null = null;
    let origenUbicacion: ProductoClienteItem['origenUbicacion'] = null;
    if (coordValida(latPos, lngPos)) {
      lat = latPos;
      lng = lngPos;
      origenUbicacion = 'posicion';
    } else if (coordValida(latInm, lngInm)) {
      lat = latInm;
      lng = lngInm;
      origenUbicacion = 'inmueble';
    }

    const asignados = new Map<number, string>();
    for (const u of usuarios.porInstalacion.get(idInstalacion) ?? []) {
      asignados.set(u.id, u.nombre);
    }

    return {
      idInstalacion,
      idProducto: num(row.idProducto),
      tipo: tipoProducto(row, panel),
      idTipoProducto: num(row.idTipoProducto),
      nombreTipoProducto: str(row.nombreTipoProducto),
      nombreProducto: str(row.nombreProducto),

      idDispositivo: num(row.idDispositivo),
      idTipoDispositivo: num(row.idTipoDispositivo),
      nombreTipoDispositivo: str(row.nombreTipoDispositivo),
      imei,
      numeroSerie: str(row.numeroSerie),

      placas: str(row.placas),
      economico: str(row.economico),
      marca: str(row.marca),
      modelo: str(row.modelo),
      anio: num(row.anio),
      nombreActivo: str(row.nombreActivo),
      inmueble: str(row.inmueble),
      direccionInmueble: str(row.direccionInmueble),
      nombrePersona: str(row.nombrePersona),
      telefonoPersona: str(row.telefonoPersona),

      cuentaSia: str(row.cuentaSia),
      nombrePanel: str(row.nombrePanel),
      panelEnLinea: panel
        ? calcularOnline(row.ultimoHeartbeat as Date | string | null, umbral)
        : null,
      ultimoHeartbeat: panel ? fecha(row.ultimoHeartbeat) : null,
      ultimoEventoTipo: str(evento?.tipoEvento),
      ultimoEventoCodigo: str(evento?.codigoSia),
      ultimoEventoZona: num(evento?.zona),
      ultimoEventoRestauracion:
        evento != null ? Number(evento.esRestauracion) === 1 : null,
      ultimoEventoFecha: fecha(evento?.recibidoEn),

      lat,
      lng,
      origenUbicacion,
      estado: num(pos?.estado),
      velocidad: num(pos?.velocidad),
      ignicion: num(pos?.ignicion),
      fechaHora: fecha(pos?.fechaHora),

      idsUsuario: [...asignados.keys()],
      usuarios: asignados.size ? [...asignados.values()].join(', ') : null,
    };
  }
}

type UsuarioAsignado = { id: number; nombre: string };

function esPanel(row: Record<string, unknown>): boolean {
  return (
    row.idPanel != null ||
    num(row.idTipoDispositivo) === EnumTipoDispositivo.PANEL_ALARMA
  );
}

function tipoProducto(
  row: Record<string, unknown>,
  panel: boolean,
): TipoProductoCliente {
  if (panel) return 'panel';
  switch (num(row.idTipoProducto)) {
    case EnumTipoProducto.VEHICULO:
      return 'vehiculo';
    case EnumTipoProducto.ACTIVO:
      return 'activo';
    case EnumTipoProducto.INMUEBLE:
      return 'inmueble';
    case EnumTipoProducto.PERSONA:
      return 'persona';
    default:
      return 'otro';
  }
}

/** `?, ?, ?` para un IN con un parámetro por valor. */
function marcas(valores: unknown[]): string {
  return valores.map(() => '?').join(', ');
}

function coordValida(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && !(lat === 0 && lng === 0);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function fecha(value: unknown): string | null {
  if (value == null || value === '') return null;
  return formatFechaPosicion(value as string | Date);
}

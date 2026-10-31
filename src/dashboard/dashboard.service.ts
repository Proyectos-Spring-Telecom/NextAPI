import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EnumEstatusProductoDispositivo,
  EnumRoles,
  EnumTipoDispositivo,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import {
  isTenantForbidden,
  TenantFilterService,
} from 'src/common/tenant-filter/tenant-filter.service';
import { calcularOnline } from 'src/alarmas/alarmas-mapper';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Posiciones } from 'src/entities/Posiciones';
import { Usuarios } from 'src/entities/Usuarios';
import { Vehiculos } from 'src/entities/Vehiculos';
import { num, str } from 'src/monitoreo/monitoreo.mapper';
import { MonitoreoService } from 'src/monitoreo/monitoreo.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';
import {
  CACHE_ALERTAS_MS,
  CACHE_MS,
  DIAS_ALERTAS,
  DIAS_LOGIN_ACTIVO,
  ESTADOS_ALERTA,
  HORAS_SIN_REPORTE,
  LOTE_IMEIS,
  MIN_EN_LINEA,
  ROLES_DASHBOARD_OPERACION,
  TOP_CLIENTES,
  TOP_EXCESOS,
  TOP_SIN_REPORTE,
  ULTIMAS_INSTALACIONES,
  ULTIMAS_INSTALACIONES_CLIENTE,
  VELOCIDAD_EXCESO,
  VELOCIDAD_MOVIMIENTO,
} from './dashboard.constants';
import {
  DashboardAlertaDia,
  DashboardCategoriaEquipo,
  DashboardDispositivoTipo,
  DashboardEquipo,
  DashboardEstadoInstalacion,
  DashboardEstadoMovimiento,
  DashboardExcesoDia,
  DashboardExcesoTop,
  DashboardHero,
  DashboardProductoTipo,
  DashboardResponse,
  DashboardSinReporte,
  DashboardTotal,
  DashboardTotalClave,
  DashboardTotalExtra,
  DashboardUltimaInstalacion,
  DashboardUnidadAhora,
  DashboardUnidadCliente,
  DashboardVista,
} from './dashboard.types';

/** Roles sin filtro de cliente (mismo criterio que TenantFilterService). */
const ROLES_GLOBALES: readonly number[] = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.MONITOREO,
  EnumRoles.TECNICO,
];

/** totales.usuarios */
const ROLES_ADMIN_CLIENTE: readonly number[] = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.MONITOREO,
  EnumRoles.CLIENTE,
];

/** totales.clientes, dispositivosPorTipo, unidadesPorCliente */
const ROLES_CLIENTES_DISPOSITIVOS: readonly number[] = [
  ...ROLES_ADMIN_CLIENTE,
  EnumRoles.TECNICO,
];

/**
 * Solo posiciones de la vigencia actual del equipo (docs/motor-activos.md §6):
 * lo que transmitió antes de la instalación vigente es de otra unidad o de otro
 * cliente. Basta el tramo vigente para la ventana de días del tablero; un
 * equipo que salió de la unidad dentro de esa ventana no se cuenta.
 */
const SQL_VIGENCIA_ACTUAL = `
  JOIN Dispositivos dVig ON dVig.Imei = p.Imei
  JOIN Instalaciones iVig ON iVig.IdDispositivo = dVig.Id AND iVig.Estatus = 1
                         AND p.FechaHora >= iVig.VigenteDesde`;

/** Valores de UltimaPosicion.Estado que ya genera el sistema. */
const ESTADO_MOVIMIENTO = 1;
const ESTADO_DETENIDO_30 = 4;
const ESTADO_DETENIDO_60 = 5;
const ESTADO_DETENIDO_90 = 6;
const ESTADO_EXCESO = 7;

const ETIQUETAS_TOTALES: Record<DashboardTotalClave, string> = {
  clientes: 'Clientes',
  usuarios: 'Usuarios',
};

const ETIQUETAS_CATEGORIA: Record<DashboardCategoriaEquipo, string> = {
  vehiculos: 'Vehículos',
  paneles: 'Paneles',
  activos: 'Activos',
  telefonos: 'Teléfonos',
};

const ETIQUETAS_CLIENTES_CON: Record<DashboardCategoriaEquipo, string> = {
  vehiculos: 'Con vehículos',
  paneles: 'Con paneles',
  activos: 'Con activos',
  telefonos: 'Con teléfonos',
};

const ORDEN_EQUIPOS: readonly DashboardCategoriaEquipo[] = [
  'vehiculos',
  'paneles',
  'activos',
  'telefonos',
];

const ORDEN_ESTADO_MOVIMIENTO: readonly DashboardCategoriaEquipo[] = [
  'vehiculos',
  'activos',
  'telefonos',
  'paneles',
];

type GrupoMovimiento =
  | 'sinReporte'
  | 'exceso'
  | 'movimiento'
  | 'detenido90'
  | 'detenido60'
  | 'detenido30'
  | 'detenido';

type InstalacionBase = {
  idInstalacion: number;
  idCliente: number;
  cliente: string;
  idTipoProducto: number;
  tipo: string;
  unidad: string;
  idDispositivo: number | null;
  idTipoDispositivo: number | null;
  imei: string | null;
  /** Tipo · modelo del dispositivo */
  dispositivo: string | null;
  /** Sims.NumeroTelefono */
  sim: string | null;
  tienePanel: boolean;
  ultimoHeartbeat: Date | string | null;
  /** PanelAlarma.UltimoHeartbeat 'YYYY-MM-DD HH:mm:ss' */
  ultimoHeartbeatTexto: string | null;
  /** VigenteDesde 'YYYY-MM-DD HH:mm:ss' */
  vigenteDesde: string | null;
  idHistoricoInstalacion: number | null;
  /** UltimaPosicion.FechaHora 'YYYY-MM-DD HH:mm:ss' */
  fechaHora: string | null;
  velocidad: number | null;
  estado: number | null;
};

type Excesos = {
  excesosPorDia: DashboardExcesoDia[];
  excesosTop: DashboardExcesoTop[];
};

type AlcanceClientes = 'all' | number[];

type FiltroCliente = { sql: string; params: unknown[]; sinAcceso: boolean };

type ConteoTotal = { valor: number; destacado: number };

type ConteoUsuarios = ConteoTotal & {
  inactivos: number;
  porRol: DashboardTotalExtra[];
};

type EntradaCache<T> = { expira: number; promesa: Promise<T> };

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private readonly cacheRespuesta = new Map<
    string,
    EntradaCache<DashboardResponse>
  >();
  private readonly cacheAlertas = new Map<
    string,
    EntradaCache<DashboardAlertaDia[]>
  >();
  private readonly cacheExcesos = new Map<string, EntradaCache<Excesos>>();

  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    private readonly tenantFilter: TenantFilterService,
    private readonly monitoreoService: MonitoreoService,
    private readonly config: ConfigService,
  ) { }

  async obtener(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<DashboardResponse> {
    const rolNum = Number(rol);
    const porUsuario =
      rolNum === EnumRoles.OPERADOR || rolNum === EnumRoles.USUARIO;
    const clave = `${rolNum}|${idClienteToken}|${porUsuario ? idUsuario : ''}`;

    try {
      return await this.memo(this.cacheRespuesta, clave, CACHE_MS, () =>
        this.calcular(idUsuario, idClienteToken, rolNum, clave),
      );
    } catch (error) {
      this.logError('respuesta', error);
      return respuestaVacia(nowMexicoCityMysql(), rolNum);
    }
  }

  private async calcular(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
    clave: string,
  ): Promise<DashboardResponse> {
    const ahora = nowMexicoCityMysql();
    const hoy = ahora.slice(0, 10);
    const esGlobal = ROLES_GLOBALES.includes(rol);
    const vista = vistaDeRol(rol);
    const esOperacion = vista === 'operacion';
    const verAdminCliente = esOperacion && ROLES_ADMIN_CLIENTE.includes(rol);
    const verClientesDispositivos =
      esOperacion && ROLES_CLIENTES_DISPOSITIVOS.includes(rol);

    let idsVisibles: number[] | null = null;
    if (!esGlobal) {
      idsVisibles = await this.monitoreoService.idsInstalacionesVisibles(
        idUsuario,
        idClienteToken,
        rol,
      );
      if (idsVisibles.length === 0) {
        return respuestaVacia(ahora, rol);
      }
    }

    const [base, alcanceClientes] = await Promise.all([
      this.pieza<InstalacionBase[] | null>('base', null, () =>
        this.cargarBase(idsVisibles),
      ),
      this.pieza<AlcanceClientes>('alcanceClientes', [], () =>
        this.tenantFilter.idsClientePermitidos(rol, idClienteToken),
      ),
    ]);

    if (base && base.length === 0) {
      return respuestaVacia(ahora, rol);
    }

    const unidades = base ?? [];
    const gps = unidades.filter(esUnidadGps);
    const imeis = [
      ...new Set(gps.map((u) => u.imei).filter((i): i is string => !!i)),
    ];
    const consultarPosiciones = esGlobal || base != null;

    const [alertasPorDia, excesos, clientes, usuarios, dispositivosPorTipo] =
      await Promise.all([
        consultarPosiciones
          ? this.memo(this.cacheAlertas, clave, CACHE_ALERTAS_MS, () =>
            this.consultarAlertasPorDia(esGlobal ? null : imeis, ahora),
          ).catch((error) => {
            this.logError('alertasPorDia', error);
            return [] as DashboardAlertaDia[];
          })
          : Promise.resolve([] as DashboardAlertaDia[]),
        consultarPosiciones
          ? this.memo(this.cacheExcesos, clave, CACHE_ALERTAS_MS, () =>
            this.consultarExcesos(esGlobal ? null : imeis, unidades, ahora),
          ).catch((error): Excesos => {
            this.logError('excesosVelocidad', error);
            return { excesosPorDia: [], excesosTop: [] };
          })
          : Promise.resolve<Excesos>({ excesosPorDia: [], excesosTop: [] }),
        verClientesDispositivos
          ? this.pieza<ConteoTotal | null>('totales.clientes', null, () =>
            this.contarClientes(alcanceClientes, hoy),
          )
          : Promise.resolve(null),
        verAdminCliente
          ? this.pieza<ConteoUsuarios | null>('totales.usuarios', null, () =>
            this.contarUsuarios(alcanceClientes, ahora),
          )
          : Promise.resolve(null),
        verClientesDispositivos
          ? this.pieza<DashboardDispositivoTipo[]>(
            'dispositivosPorTipo',
            [],
            () => this.consultarDispositivosPorTipo(alcanceClientes),
          )
          : Promise.resolve([] as DashboardDispositivoTipo[]),
      ]);

    const hero = this.piezaSync<DashboardHero>('hero', heroCeros(), () =>
      base ? calcularHero(unidades, gps, ahora) : heroCeros(),
    );

    const totales = this.piezaSync<DashboardTotal[]>('totales', [], () => {
      const filas: DashboardTotal[] = [];
      if (clientes) {
        const porCategoria = clientesPorCategoria(unidades);
        filas.push(
          total('clientes', clientes, 'alta este mes', [
            { etiqueta: 'Con unidades activas', valor: hero.clientes },
            ...ORDEN_EQUIPOS.map((categoria) => ({
              etiqueta: ETIQUETAS_CLIENTES_CON[categoria],
              valor: porCategoria.get(categoria) ?? 0,
            })).filter((extra) => extra.valor > 0),
          ]),
        );
      }
      if (usuarios) {
        filas.push(
          total('usuarios', usuarios, 'entraron en 7 días', [
            { etiqueta: 'Activos', valor: usuarios.valor },
            { etiqueta: 'Inactivos', valor: usuarios.inactivos },
            ...usuarios.porRol,
          ]),
        );
      }
      return filas;
    });

    const threshold = this.thresholdMs();

    const equipos = this.piezaSync<DashboardEquipo[]>('equipos', [], () =>
      base ? calcularEquipos(unidades, ahora, threshold) : [],
    );

    const estadoMovimiento = this.piezaSync<DashboardEstadoMovimiento[]>(
      'estadoMovimiento',
      [],
      () => (base ? calcularEstadoMovimiento(unidades, ahora, threshold) : []),
    );

    const unidadesAhora = this.piezaSync<DashboardUnidadAhora[]>(
      'unidadesAhora',
      [],
      () => (base ? calcularUnidadesAhora(gps, ahora) : []),
    );

    const productosPorTipo = this.piezaSync<DashboardProductoTipo[]>(
      'productosPorTipo',
      [],
      () => {
        if (!esOperacion) return [];
        const porTipo = new Map<number, DashboardProductoTipo>();
        for (const u of unidades) {
          const item = porTipo.get(u.idTipoProducto) ?? {
            idTipoProducto: u.idTipoProducto,
            tipo: u.tipo,
            total: 0,
          };
          item.total++;
          porTipo.set(u.idTipoProducto, item);
        }
        return [...porTipo.values()].sort((a, b) => b.total - a.total);
      },
    );

    const unidadesPorCliente = verClientesDispositivos
      ? this.piezaSync<DashboardUnidadCliente[]>('unidadesPorCliente', [], () => {
        const porCliente = new Map<number, DashboardUnidadCliente>();
        for (const u of unidades) {
          const item = porCliente.get(u.idCliente) ?? {
            idCliente: u.idCliente,
            cliente: u.cliente,
            total: 0,
          };
          item.total++;
          porCliente.set(u.idCliente, item);
        }
        if (porCliente.size <= 1) return [];
        return [...porCliente.values()]
          .sort((a, b) => b.total - a.total)
          .slice(0, TOP_CLIENTES);
      })
      : [];

    const limiteSinReporte = restarMinutos(ahora, HORAS_SIN_REPORTE * 60);

    const ultimasInstalaciones = this.piezaSync<DashboardUltimaInstalacion[]>(
      'ultimasInstalaciones',
      [],
      () =>
        [...unidades]
          .sort(
            (a, b) =>
              (b.vigenteDesde ?? '').localeCompare(a.vigenteDesde ?? '') ||
              b.idInstalacion - a.idInstalacion,
          )
          .slice(
            0,
            esOperacion ? ULTIMAS_INSTALACIONES : ULTIMAS_INSTALACIONES_CLIENTE,
          )
          .map(
            (u): DashboardUltimaInstalacion => ({
              idInstalacion: u.idInstalacion,
              unidad: u.unidad,
              tipo: u.tipo,
              idTipoProducto: u.idTipoProducto,
              cliente: u.cliente,
              fecha: u.vigenteDesde ?? '',
              imei: u.imei,
              dispositivo: u.dispositivo,
              sim: u.sim,
              estado: estadoInstalacion(u, limiteSinReporte, threshold),
              ultimoReporte: ultimoReporteIso(u),
              velocidad: u.velocidad,
            }),
          ),
    );

    const sinReporteTop = esOperacion
      ? []
      : this.piezaSync<DashboardSinReporte[]>('sinReporteTop', [], () =>
        calcularSinReporteTop(unidades, ahora, limiteSinReporte, threshold),
      );

    return {
      vista,
      generadoEn: ahora,
      alcance: {
        rol,
        clientes: hero.clientes,
        unidades: hero.instalacionesActivas,
      },
      hero: [hero],
      totales,
      equipos,
      estadoMovimiento,
      unidadesAhora,
      alertasPorDia,
      excesosPorDia: excesos.excesosPorDia,
      excesosTop: excesos.excesosTop,
      productosPorTipo,
      dispositivosPorTipo,
      unidadesPorCliente,
      ultimasInstalaciones,
      sinReporteTop,
    };
  }

  // ───────────────────────── Consultas ─────────────────────────

  /** `ids` null = roles globales (solo Estatus = 1, sin IN). */
  private async cargarBase(ids: number[] | null): Promise<InstalacionBase[]> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin('i.idCliente2', 'c')
      .innerJoin('i.idProducto2', 'p')
      .leftJoin('p.idTipoProducto2', 'ctp')
      .leftJoin('i.idDispositivo2', 'd')
      .leftJoin(CatTipoDispositivo, 'td', 'td.id = d.idTipoDispositivo')
      .leftJoin('d.idModelo2', 'modDisp')
      .leftJoin('i.idSim2', 's')
      .leftJoin('d.ultimaPosicion', 'up', 'up.fechaHora >= i.vigenteDesde')
      .leftJoin(
        PanelAlarma,
        'pa',
        'pa.idDispositivo = d.id',
      )
      .leftJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
      .select([
        'i.id AS idInstalacion',
        'i.idCliente AS idCliente',
        "CONCAT_WS(' ', c.nombre, c.apellidoPaterno, c.apellidoMaterno) AS nombreCompletoCliente",
        'p.idTipoProducto AS idTipoProducto',
        'ctp.nombre AS nombreTipoProducto',
        'p.nombre AS nombreProducto',
        'v.placa AS placaVehiculo',
        'v.numeroEconomico AS ecoVehiculo',
        'i.idDispositivo AS idDispositivo',
        'd.idTipoDispositivo AS idTipoDispositivo',
        'CAST(d.imei AS CHAR) AS imei',
        'td.nombre AS nombreTipoDispositivo',
        'modDisp.nombre AS modeloDispositivo',
        's.numeroTelefono AS numeroSim',
        "DATE_FORMAT(i.vigenteDesde, '%Y-%m-%d %H:%i:%s') AS vigenteDesde",
        'i.idHistoricoInstalacion AS idHistoricoInstalacion',
        'CASE WHEN pa.idDispositivo IS NULL THEN 0 ELSE 1 END AS tienePanel',
        'pa.ultimoHeartbeat AS ultimoHeartbeat',
        "DATE_FORMAT(pa.ultimoHeartbeat, '%Y-%m-%d %H:%i:%s') AS ultimoHeartbeatTexto",
        "DATE_FORMAT(up.fechaHora, '%Y-%m-%d %H:%i:%s') AS upFechaHora",
        'up.velocidad AS upVelocidad',
        'up.estado AS upEstado',
      ])
      .where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO });

    if (ids) {
      qb.andWhere('i.id IN (:...ids)', { ids });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();

    const vistos = new Set<number>();
    const unidades: InstalacionBase[] = [];
    for (const row of rows) {
      const idInstalacion = Number(row.idInstalacion);
      if (!Number.isFinite(idInstalacion) || vistos.has(idInstalacion)) {
        continue;
      }
      vistos.add(idInstalacion);

      const idTipoProducto = Number(row.idTipoProducto);
      unidades.push({
        idInstalacion,
        idCliente: Number(row.idCliente),
        cliente: str(row.nombreCompletoCliente) ?? '',
        idTipoProducto,
        tipo: str(row.nombreTipoProducto) ?? '',
        unidad: etiquetaUnidad(idInstalacion, idTipoProducto, row),
        idDispositivo: num(row.idDispositivo),
        idTipoDispositivo: num(row.idTipoDispositivo),
        imei: imeiToString(row.imei),
        dispositivo: unirPartes([
          str(row.nombreTipoDispositivo),
          str(row.modeloDispositivo),
        ]),
        sim: str(row.numeroSim),
        tienePanel: Number(row.tienePanel) === 1,
        ultimoHeartbeat: (row.ultimoHeartbeat as Date | string | null) ?? null,
        ultimoHeartbeatTexto: str(row.ultimoHeartbeatTexto),
        vigenteDesde: str(row.vigenteDesde),
        idHistoricoInstalacion: num(row.idHistoricoInstalacion),
        fechaHora: str(row.upFechaHora),
        velocidad: num(row.upVelocidad),
        estado: num(row.upEstado),
      });
    }
    return unidades;
  }

  /** `imeis` null = roles globales (sin filtro de IMEI, índice IX_Posiciones_Fecha). */
  private async consultarAlertasPorDia(
    imeis: string[] | null,
    ahora: string,
  ): Promise<DashboardAlertaDia[]> {
    const fechas = fechasAlertas(ahora.slice(0, 10));
    const desde = `${fechas[0]} 00:00:00`;
    const porFecha = new Map<string, number>(fechas.map((f) => [f, 0]));
    const estados = ESTADOS_ALERTA.map(() => '?').join(', ');

    const acumular = (rows: Record<string, unknown>[]) => {
      for (const r of rows) {
        const fecha = String(r.fecha);
        if (porFecha.has(fecha)) {
          porFecha.set(fecha, (porFecha.get(fecha) ?? 0) + numero(r.total));
        }
      }
    };

    if (imeis === null) {
      const rows: Record<string, unknown>[] = await this.posicionesRepo.query(
        `SELECT DATE_FORMAT(FechaHora, '%Y-%m-%d') AS fecha, COUNT(*) AS total
           FROM Posiciones
          WHERE FechaHora >= ? AND FechaHora <= ?
            AND Estado IN (${estados})
          GROUP BY DATE_FORMAT(FechaHora, '%Y-%m-%d')`,
        [desde, ahora, ...ESTADOS_ALERTA],
      );
      acumular(rows);
    } else {
      for (let i = 0; i < imeis.length; i += LOTE_IMEIS) {
        const lote = imeis.slice(i, i + LOTE_IMEIS);
        const rows: Record<string, unknown>[] =
          await this.posicionesRepo.query(
            `SELECT DATE_FORMAT(p.FechaHora, '%Y-%m-%d') AS fecha, COUNT(*) AS total
               FROM Posiciones p
               ${SQL_VIGENCIA_ACTUAL}
              WHERE p.Imei IN (${lote.map(() => '?').join(', ')})
                AND p.FechaHora >= ? AND p.FechaHora <= ?
                AND p.Estado IN (${estados})
              GROUP BY DATE_FORMAT(p.FechaHora, '%Y-%m-%d')`,
            [...lote, desde, ahora, ...ESTADOS_ALERTA],
          );
        acumular(rows);
      }
    }

    return fechas.map((fecha) => ({ fecha, total: porFecha.get(fecha) ?? 0 }));
  }

  /**
   * Excesos (> VELOCIDAD_EXCESO) de 7 días agrupados por IMEI y fecha.
   * `imeis` null = roles globales (sin filtro de IMEI).
   */
  private async consultarExcesos(
    imeis: string[] | null,
    unidades: InstalacionBase[],
    ahora: string,
  ): Promise<Excesos> {
    const fechas = fechasAlertas(ahora.slice(0, 10));
    const desde = `${fechas[0]} 00:00:00`;

    const filas: Record<string, unknown>[] = [];
    if (imeis === null) {
      const rows: Record<string, unknown>[] = await this.posicionesRepo.query(
        `SELECT CAST(Imei AS CHAR) AS imei,
                DATE_FORMAT(FechaHora, '%Y-%m-%d') AS fecha,
                COUNT(*) AS reportes,
                MAX(Velocidad) AS velocidadMax
           FROM Posiciones
          WHERE Velocidad > ? AND FechaHora >= ? AND FechaHora <= ?
          GROUP BY Imei, DATE_FORMAT(FechaHora, '%Y-%m-%d')`,
        [VELOCIDAD_EXCESO, desde, ahora],
      );
      filas.push(...rows);
    } else {
      for (let i = 0; i < imeis.length; i += LOTE_IMEIS) {
        const lote = imeis.slice(i, i + LOTE_IMEIS);
        const rows: Record<string, unknown>[] =
          await this.posicionesRepo.query(
            `SELECT CAST(p.Imei AS CHAR) AS imei,
                    DATE_FORMAT(p.FechaHora, '%Y-%m-%d') AS fecha,
                    COUNT(*) AS reportes,
                    MAX(p.Velocidad) AS velocidadMax
               FROM Posiciones p
               ${SQL_VIGENCIA_ACTUAL}
              WHERE p.Imei IN (${lote.map(() => '?').join(', ')})
                AND p.Velocidad > ? AND p.FechaHora >= ? AND p.FechaHora <= ?
              GROUP BY p.Imei, DATE_FORMAT(p.FechaHora, '%Y-%m-%d')`,
            [...lote, VELOCIDAD_EXCESO, desde, ahora],
          );
        filas.push(...rows);
      }
    }

    const porFecha = new Map(
      fechas.map((fecha) => [fecha, { reportes: 0, imeis: new Set<string>() }]),
    );
    const porImei = new Map<string, { reportes: number; velocidadMax: number }>();

    for (const r of filas) {
      const imei = imeiToString(r.imei);
      if (!imei) continue;
      const reportes = numero(r.reportes);
      const velocidadMax = numero(r.velocidadMax);

      const dia = porFecha.get(String(r.fecha));
      if (dia) {
        dia.reportes += reportes;
        dia.imeis.add(imei);
      }

      const acc = porImei.get(imei) ?? { reportes: 0, velocidadMax: 0 };
      acc.reportes += reportes;
      acc.velocidadMax = Math.max(acc.velocidadMax, velocidadMax);
      porImei.set(imei, acc);
    }

    const instalacionPorImei = new Map<string, InstalacionBase>();
    for (const u of unidades) {
      if (u.imei && !instalacionPorImei.has(u.imei)) {
        instalacionPorImei.set(u.imei, u);
      }
    }

    const excesosTop: DashboardExcesoTop[] = [];
    for (const [imei, acc] of porImei) {
      const u = instalacionPorImei.get(imei);
      if (!u) continue;
      excesosTop.push({
        idInstalacion: u.idInstalacion,
        unidad: u.unidad,
        cliente: u.cliente,
        velocidadMax: acc.velocidadMax,
        reportes: acc.reportes,
      });
    }

    return {
      excesosPorDia: fechas.map((fecha) => {
        const dia = porFecha.get(fecha);
        return {
          fecha,
          reportes: dia?.reportes ?? 0,
          unidades: dia?.imeis.size ?? 0,
        };
      }),
      excesosTop: excesosTop
        .sort(
          (a, b) => b.velocidadMax - a.velocidadMax || b.reportes - a.reportes,
        )
        .slice(0, TOP_EXCESOS),
    };
  }

  private async contarClientes(
    alcance: AlcanceClientes,
    hoy: string,
  ): Promise<ConteoTotal> {
    const f = this.filtroCliente(alcance, 'c', 'Id');
    if (f.sinAcceso) return { valor: 0, destacado: 0 };

    const rows: Record<string, unknown>[] = await this.clientesRepo.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN c.FechaCreacion >= ? THEN 1 ELSE 0 END) AS destacado
         FROM Clientes c
        WHERE c.Estatus = ? ${f.sql}`,
      [`${hoy.slice(0, 7)}-01 00:00:00`, EstatusEnum.ACTIVO, ...f.params],
    );
    return {
      valor: numero(rows[0]?.total),
      destacado: numero(rows[0]?.destacado),
    };
  }

  private async contarUsuarios(
    alcance: AlcanceClientes,
    ahora: string,
  ): Promise<ConteoUsuarios> {
    const f = this.filtroCliente(alcance, 'u');
    if (f.sinAcceso) {
      return { valor: 0, destacado: 0, inactivos: 0, porRol: [] };
    }

    const [rows, roles]: Record<string, unknown>[][] = await Promise.all([
      this.usuariosRepo.query(
        `SELECT SUM(CASE WHEN u.Estatus = ? THEN 1 ELSE 0 END) AS total,
                SUM(CASE WHEN u.Estatus = ? AND u.UltimoLogin >= ? THEN 1 ELSE 0 END) AS destacado,
                SUM(CASE WHEN u.Estatus <> ? THEN 1 ELSE 0 END) AS inactivos
           FROM Usuarios u
          WHERE 1 = 1 ${f.sql}`,
        [
          EstatusEnum.ACTIVO,
          EstatusEnum.ACTIVO,
          restarMinutos(ahora, DIAS_LOGIN_ACTIVO * 24 * 60),
          EstatusEnum.ACTIVO,
          ...f.params,
        ],
      ),
      this.usuariosRepo.query(
        `SELECT r.Nombre AS rol, COUNT(*) AS total
           FROM Usuarios u
          INNER JOIN Roles r ON r.Id = u.IdRol
          WHERE u.Estatus = ? ${f.sql}
          GROUP BY r.Id, r.Nombre`,
        [EstatusEnum.ACTIVO, ...f.params],
      ),
    ]);

    return {
      valor: numero(rows[0]?.total),
      destacado: numero(rows[0]?.destacado),
      inactivos: numero(rows[0]?.inactivos),
      porRol: roles
        .map((r) => ({ etiqueta: str(r.rol) ?? '', valor: numero(r.total) }))
        .filter((r) => r.valor > 0)
        .sort((a, b) => b.valor - a.valor),
    };
  }

  private async consultarDispositivosPorTipo(
    alcance: AlcanceClientes,
  ): Promise<DashboardDispositivoTipo[]> {
    const f = this.filtroCliente(alcance, 'd');
    if (f.sinAcceso) return [];

    const rows: Record<string, unknown>[] = await this.dispositivosRepo.query(
      `SELECT d.IdTipoDispositivo AS idTipoDispositivo,
              td.Nombre AS tipo,
              COUNT(*) AS total
         FROM Dispositivos d
         LEFT JOIN CatTipoDispositivo td ON td.Id = d.IdTipoDispositivo
        WHERE d.Estatus <> ? ${f.sql}
        GROUP BY d.IdTipoDispositivo, td.Nombre
        ORDER BY total DESC`,
      [EnumEstatusProductoDispositivo.INSERVIBLE, ...f.params],
    );
    return rows
      .map((r) => ({
        idTipoDispositivo: numero(r.idTipoDispositivo),
        tipo: str(r.tipo) ?? '',
        total: numero(r.total),
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  // ───────────────────────── Utilidades ─────────────────────────

  /** Caché por alcance; peticiones simultáneas comparten la misma promesa en curso. */
  private memo<T>(
    cache: Map<string, EntradaCache<T>>,
    clave: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const ahora = Date.now();
    const actual = cache.get(clave);
    if (actual && actual.expira > ahora) {
      return actual.promesa;
    }

    for (const [k, v] of cache) {
      if (v.expira <= ahora) cache.delete(k);
    }

    const entrada: EntradaCache<T> = {
      expira: Number.POSITIVE_INFINITY,
      promesa: fn(),
    };
    cache.set(clave, entrada);
    entrada.promesa.then(
      () => {
        entrada.expira = Date.now() + ttlMs;
      },
      () => {
        if (cache.get(clave) === entrada) cache.delete(clave);
      },
    );
    return entrada.promesa;
  }

  private async pieza<T>(
    nombre: string,
    vacio: T,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logError(nombre, error);
      return vacio;
    }
  }

  private piezaSync<T>(nombre: string, vacio: T, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      this.logError(nombre, error);
      return vacio;
    }
  }

  private logError(bloque: string, error: unknown): void {
    this.logger.error(
      `Dashboard: falló el bloque "${bloque}" — ${(error as Error)?.message}`,
      (error as Error)?.stack,
    );
  }

  private filtroCliente(
    alcance: AlcanceClientes,
    alias: string,
    columna = 'IdCliente',
  ): FiltroCliente {
    const filtro = this.tenantFilter.aplicarFiltroListado(
      alcance,
      undefined,
      alias,
      columna,
    );
    if (isTenantForbidden(filtro)) {
      return { sql: ' AND 1 = 0 ', params: [], sinAcceso: true };
    }
    return filtro;
  }

  private thresholdMs(): number {
    return Number(
      this.config.get<number>('SIA_OFFLINE_THRESHOLD_MS') ?? 600_000,
    );
  }
}

// ───────────────────────── Funciones puras ─────────────────────────

function esUnidadGps(u: InstalacionBase): boolean {
  return u.idTipoProducto !== EnumTipoProducto.INMUEBLE && u.imei != null;
}

function categoriaEquipo(u: InstalacionBase): DashboardCategoriaEquipo | null {
  if (u.idTipoProducto === EnumTipoProducto.INMUEBLE) {
    return 'paneles';
  }
  if (
    u.idTipoDispositivo === EnumTipoDispositivo.TELEFONO ||
    u.idTipoProducto === EnumTipoProducto.PERSONA
  ) {
    return 'telefonos';
  }
  if (u.idTipoProducto === EnumTipoProducto.VEHICULO && u.idDispositivo != null) {
    return 'vehiculos';
  }
  if (u.idTipoProducto === EnumTipoProducto.ACTIVO) {
    return 'activos';
  }
  return null;
}

function grupoMovimiento(
  u: InstalacionBase,
  limiteSinReporte: string,
): GrupoMovimiento {
  const velocidad = u.velocidad ?? 0;
  if (esSinReporte(u, limiteSinReporte)) return 'sinReporte';
  if (velocidad > VELOCIDAD_EXCESO || u.estado === ESTADO_EXCESO) {
    return 'exceso';
  }
  if (u.estado === ESTADO_MOVIMIENTO || velocidad > VELOCIDAD_MOVIMIENTO) {
    return 'movimiento';
  }
  if (u.estado === ESTADO_DETENIDO_90) return 'detenido90';
  if (u.estado === ESTADO_DETENIDO_60) return 'detenido60';
  if (u.estado === ESTADO_DETENIDO_30) return 'detenido30';
  return 'detenido';
}

function estadoInstalacion(
  u: InstalacionBase,
  limiteSinReporte: string,
  threshold: number,
): DashboardEstadoInstalacion {
  if (categoriaEquipo(u) === 'paneles') {
    return calcularOnline(u.ultimoHeartbeat, threshold)
      ? 'enLinea'
      : 'fueraLinea';
  }
  return grupoMovimiento(u, limiteSinReporte);
}

/** UltimaPosicion.FechaHora (UltimoHeartbeat en paneles) como 'YYYY-MM-DDTHH:mm:ss'. */
function ultimoReporteIso(u: InstalacionBase): string | null {
  const valor =
    categoriaEquipo(u) === 'paneles' ? u.ultimoHeartbeatTexto : u.fechaHora;
  return valor ? valor.replace(' ', 'T') : null;
}

function calcularSinReporteTop(
  unidades: InstalacionBase[],
  ahora: string,
  limiteSinReporte: string,
  threshold: number,
): DashboardSinReporte[] {
  const ahoraMs = Date.parse(`${ahora.replace(' ', 'T')}Z`);
  const filas: DashboardSinReporte[] = [];

  for (const u of unidades) {
    const categoria = categoriaEquipo(u);
    if (!categoria) continue;

    const estado = estadoInstalacion(u, limiteSinReporte, threshold);
    if (estado !== 'sinReporte' && estado !== 'fueraLinea') continue;

    const ultimoReporte = ultimoReporteIso(u);
    filas.push({
      idInstalacion: u.idInstalacion,
      unidad: u.unidad,
      categoria,
      ultimoReporte,
      horas: ultimoReporte
        ? Math.max(
          0,
          Math.floor((ahoraMs - Date.parse(`${ultimoReporte}Z`)) / 3_600_000),
        )
        : null,
    });
  }

  return filas
    .sort((a, b) => {
      if (a.ultimoReporte == null || b.ultimoReporte == null) {
        return (
          Number(a.ultimoReporte != null) - Number(b.ultimoReporte != null) ||
          a.idInstalacion - b.idInstalacion
        );
      }
      return (
        a.ultimoReporte.localeCompare(b.ultimoReporte) ||
        a.idInstalacion - b.idInstalacion
      );
    })
    .slice(0, TOP_SIN_REPORTE);
}

/** IdCliente distintos de la BASE por categoría de equipo. */
function clientesPorCategoria(
  unidades: InstalacionBase[],
): Map<DashboardCategoriaEquipo, number> {
  const porCategoria = new Map<DashboardCategoriaEquipo, Set<number>>();
  for (const u of unidades) {
    const categoria = categoriaEquipo(u);
    if (!categoria) continue;
    const clientes = porCategoria.get(categoria) ?? new Set<number>();
    clientes.add(u.idCliente);
    porCategoria.set(categoria, clientes);
  }
  return new Map(
    [...porCategoria].map(([categoria, clientes]) => [categoria, clientes.size]),
  );
}

function vistaDeRol(rol: number): DashboardVista {
  return ROLES_DASHBOARD_OPERACION.includes(rol) ? 'operacion' : 'cliente';
}

function calcularEquipos(
  unidades: InstalacionBase[],
  ahora: string,
  threshold: number,
): DashboardEquipo[] {
  const limiteSinReporte = restarMinutos(ahora, HORAS_SIN_REPORTE * 60);
  const porCategoria = new Map<DashboardCategoriaEquipo, DashboardEquipo>(
    ORDEN_EQUIPOS.map((categoria) => [
      categoria,
      {
        categoria,
        etiqueta: ETIQUETAS_CATEGORIA[categoria],
        total: 0,
        activos: 0,
        activosTexto: categoria === 'paneles' ? 'en línea' : 'en movimiento',
      },
    ]),
  );

  for (const u of unidades) {
    const categoria = categoriaEquipo(u);
    const item = categoria ? porCategoria.get(categoria) : undefined;
    if (!item) continue;

    item.total++;

    if (categoria === 'paneles') {
      if (calcularOnline(u.ultimoHeartbeat, threshold)) item.activos++;
    } else {
      const grupo = grupoMovimiento(u, limiteSinReporte);
      if (grupo === 'movimiento' || grupo === 'exceso') item.activos++;
    }
  }

  return ORDEN_EQUIPOS.map((c) => porCategoria.get(c) as DashboardEquipo);
}

function calcularEstadoMovimiento(
  unidades: InstalacionBase[],
  ahora: string,
  threshold: number,
): DashboardEstadoMovimiento[] {
  const limiteSinReporte = restarMinutos(ahora, HORAS_SIN_REPORTE * 60);
  const porCategoria = new Map<
    DashboardCategoriaEquipo,
    DashboardEstadoMovimiento
  >(
    ORDEN_ESTADO_MOVIMIENTO.map((categoria) => [
      categoria,
      estadoMovimientoCeros(categoria),
    ]),
  );

  for (const u of unidades) {
    const categoria = categoriaEquipo(u);
    const item = categoria ? porCategoria.get(categoria) : undefined;
    if (!item) continue;

    item.total++;
    if (categoria === 'paneles') {
      if (calcularOnline(u.ultimoHeartbeat, threshold)) {
        item.movimiento++;
      } else {
        item.sinReporte++;
      }
      continue;
    }
    item[grupoMovimiento(u, limiteSinReporte)]++;
  }

  return ORDEN_ESTADO_MOVIMIENTO.map(
    (c) => porCategoria.get(c) as DashboardEstadoMovimiento,
  );
}

function estadoMovimientoCeros(
  categoria: DashboardCategoriaEquipo,
): DashboardEstadoMovimiento {
  return {
    categoria,
    etiqueta: ETIQUETAS_CATEGORIA[categoria],
    total: 0,
    movimiento: 0,
    exceso: 0,
    detenido: 0,
    detenido30: 0,
    detenido60: 0,
    detenido90: 0,
    sinReporte: 0,
  };
}

function calcularHero(
  unidades: InstalacionBase[],
  gps: InstalacionBase[],
  ahora: string,
): DashboardHero {
  const limiteEnLinea = restarMinutos(ahora, MIN_EN_LINEA);
  const limiteSinReporte = restarMinutos(ahora, HORAS_SIN_REPORTE * 60);

  return {
    instalacionesActivas: unidades.length,
    clientes: new Set(unidades.map((u) => u.idCliente)).size,
    unidadesGps: gps.length,
    enLinea: gps.filter((u) => u.fechaHora != null && u.fechaHora >= limiteEnLinea)
      .length,
    sinReporte: gps.filter((u) => esSinReporte(u, limiteSinReporte)).length,
    paneles: unidades.filter(
      (u) => u.idTipoProducto === EnumTipoProducto.INMUEBLE && u.tienePanel,
    ).length,
  };
}

function calcularUnidadesAhora(
  gps: InstalacionBase[],
  ahora: string,
): DashboardUnidadAhora[] {
  const limiteSinReporte = restarMinutos(ahora, HORAS_SIN_REPORTE * 60);
  let movimiento = 0;
  let detenida = 0;
  let sinReporte = 0;

  for (const u of gps) {
    if (esSinReporte(u, limiteSinReporte)) {
      sinReporte++;
    } else if (
      (u.velocidad ?? 0) > VELOCIDAD_MOVIMIENTO ||
      u.estado === ESTADO_MOVIMIENTO
    ) {
      movimiento++;
    } else {
      detenida++;
    }
  }

  return [
    { estado: 'movimiento', etiqueta: 'En movimiento', total: movimiento },
    { estado: 'detenida', etiqueta: 'Detenidas', total: detenida },
    { estado: 'sinReporte', etiqueta: 'Sin reporte', total: sinReporte },
  ];
}

function esSinReporte(u: InstalacionBase, limiteSinReporte: string): boolean {
  return u.fechaHora == null || u.fechaHora < limiteSinReporte;
}

function total(
  clave: DashboardTotalClave,
  conteo: ConteoTotal,
  detalle: string,
  extras: DashboardTotalExtra[],
): DashboardTotal {
  return {
    clave,
    etiqueta: ETIQUETAS_TOTALES[clave],
    valor: conteo.valor,
    destacado: conteo.destacado,
    detalle,
    porcentaje:
      conteo.valor > 0
        ? Math.min(
          100,
          Math.max(0, Math.round((conteo.destacado / conteo.valor) * 100)),
        )
        : 0,
    extras,
  };
}

function unirPartes(partes: (string | null)[]): string | null {
  const presentes = partes.filter((p): p is string => p != null);
  return presentes.length > 0 ? presentes.join(' · ') : null;
}

function etiquetaUnidad(
  idInstalacion: number,
  idTipoProducto: number,
  row: Record<string, unknown>,
): string {
  if (idTipoProducto === EnumTipoProducto.VEHICULO) {
    const partes = [str(row.ecoVehiculo), str(row.placaVehiculo)].filter(
      (p): p is string => p != null,
    );
    if (partes.length > 0) {
      return partes.join(' · ');
    }
  }
  return str(row.nombreProducto) ?? `Instalación ${idInstalacion}`;
}

function heroCeros(): DashboardHero {
  return {
    instalacionesActivas: 0,
    clientes: 0,
    unidadesGps: 0,
    enLinea: 0,
    sinReporte: 0,
    paneles: 0,
  };
}

/** 'YYYY-MM-DD HH:mm:ss' (hora de pared) menos N minutos, mismo formato. */
function restarMinutos(fechaHora: string, minutos: number): string {
  return new Date(
    Date.parse(`${fechaHora.replace(' ', 'T')}Z`) - minutos * 60_000,
  )
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** DIAS_ALERTAS fechas 'YYYY-MM-DD' en orden ascendente terminando hoy. */
function fechasAlertas(hoy: string): string[] {
  return Array.from({ length: DIAS_ALERTAS }, (_, i) =>
    sumarDias(hoy, i - (DIAS_ALERTAS - 1)),
  );
}

function numero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function respuestaVacia(generadoEn: string, rol: number): DashboardResponse {
  const fechas = fechasAlertas(generadoEn.slice(0, 10));
  return {
    vista: vistaDeRol(rol),
    generadoEn,
    alcance: { rol, clientes: 0, unidades: 0 },
    hero: [heroCeros()],
    totales: [],
    equipos: calcularEquipos([], generadoEn, 0),
    estadoMovimiento: calcularEstadoMovimiento([], generadoEn, 0),
    unidadesAhora: calcularUnidadesAhora([], generadoEn),
    alertasPorDia: fechas.map((fecha) => ({ fecha, total: 0 })),
    excesosPorDia: fechas.map((fecha) => ({ fecha, reportes: 0, unidades: 0 })),
    excesosTop: [],
    productosPorTipo: [],
    dispositivosPorTipo: [],
    unidadesPorCliente: [],
    ultimasInstalaciones: [],
    sinReporteTop: [],
  };
}

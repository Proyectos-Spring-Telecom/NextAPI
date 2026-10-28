import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { Fotos } from 'src/entities/Fotos';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { Paginated } from 'src/common/ApiResponse';
import {
  EnumRoles,
  EnumTipoDispositivo,
  EstatusEnum,
} from 'src/common/estatus.enum';
import {
  applyPaginadoBaseJoins,
  applyPaginadoSelectBase,
  applyPaginadoTodosTiposProducto,
  mapInstalacionPaginadaPlana,
} from 'src/instalaciones/helpers/instalaciones-paginado.helpers';
import {
  formatFechaPosicion,
  parseFechaHistorico,
} from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import {
  ConsolaAlcanceService,
  MSG_IMEI_NO_ENCONTRADO,
} from '../shared/consola-alcance.service';
import {
  ConsultaGaleriaDto,
  FotosImeiDto,
  ResumenGaleriaDto,
} from './dto/consola-galeria.dto';
import {
  canalesActivosDesdeFila,
  CanalFotoResuelto,
  etiquetaInstalacion,
  extraerFotosPosicion,
  FotoGaleriaItem,
  rangoPorDefectoMesActual,
  resolverCanalFoto,
  validarRangoGaleria,
} from './consola-galeria.helpers';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';

/** Foto con su canal resuelto según el tipo de equipo (TrackCam / AVL). */
export type FotoGaleriaEtiquetada = FotoGaleriaItem & CanalFotoResuelto;

/** Tipo de equipo + canales activos (solo TrackCam), común a las respuestas. */
type EquipoGaleria = {
  idTipoDispositivo: number | null;
  nombreTipoDispositivo: string | null;
  /** Canales TrackCam activos (1..3); vacío en AVL u otros. */
  canalesActivos: number[];
};

/** Unidad (instalación activa con dispositivo) que puede tener fotos. */
export type InstalacionGaleriaItem = {
  idInstalacion: number;
  etiqueta: string;
  imei: string;
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  idTipoProducto: number | null;
  /** Vehículo, Activo, Inmueble, Persona (catálogo). */
  nombreTipoProducto: string | null;
  /** Solo vehículos (`Vehiculos` → `CatMarcas` / `CatModelos`); null en otros tipos. */
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  color: string | null;
  /** 1 = el dispositivo tiene cámara. */
  camara: number | null;
  /** Usuarios del cliente que tienen asignada la unidad (UsuariosInstalaciones activo). */
  idsUsuario: number[];
} & EquipoGaleria;

export type UsuarioGaleriaItem = {
  id: number;
  nombre: string;
  totalInstalaciones: number;
};

export type FiltrosGaleriaResult = {
  idCliente: number;
  nombreCliente: string | null;
  usuarios: UsuarioGaleriaItem[];
  instalaciones: InstalacionGaleriaItem[];
};

/** Una captura = una posición con 1..4 fotos (una por canal). */
export type CapturaGaleriaItem = {
  idPosicion: number;
  idInstalacion: number;
  etiqueta: string;
  imei: string;
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  /** `YYYY-MM-DDTHH:mm:ss` (hora de pared). */
  fechaHora: string | null;
  lat: number | null;
  lng: number | null;
  velocidad: number | null;
  fotos: FotoGaleriaEtiquetada[];
} & EquipoGaleria;

/** Sección de la galería: una unidad con fotos en el periodo. */
export type UnidadGaleriaResumenItem = {
  idInstalacion: number;
  etiqueta: string;
  imei: string;
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  idTipoProducto: number | null;
  nombreTipoProducto: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  color: string | null;
  totalCapturas: number;
  /** `YYYY-MM-DDTHH:mm:ss` de la captura más reciente. */
  ultimaCaptura: string | null;
} & EquipoGaleria;

export type ResumenGaleriaResult = {
  idCliente: number;
  nombreCliente: string | null;
  fechaInicio: string;
  fechaFinal: string;
  totalCapturas: number;
  totalUnidades: number;
  unidades: UnidadGaleriaResumenItem[];
};

/** Cabecera de la unidad resuelta por IMEI. */
export type UnidadFotosImei = {
  idInstalacion: number;
  imei: string;
  etiqueta: string;
  placas: string | null;
  economico: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  descripcion: string | null;
} & EquipoGaleria;

/** Una fila = una foto (canal) de una posición. `canal` = slot de `Posiciones` (0..3). */
export type FotoImeiItem = {
  idFoto: number;
  idPosicion: number;
  canal: number;
  url: string;
  fechaHora: string | null;
  lat: number | null;
  lng: number | null;
  velocidad: number | null;
} & CanalFotoResuelto;

export type FotosImeiResult = {
  unidad: UnidadFotosImei;
  fechaInicio: string;
  fechaFinal: string;
  data: FotoImeiItem[];
  paginated: Paginated;
};

const LIMIT_DEFAULT = 24;
const LIMIT_DEFAULT_IMEI = 20;

/** Slots de foto en `Posiciones` → canal. */
const SLOTS_FOTO_IMEI: ReadonlyArray<{ columna: string; canal: number }> = [
  { columna: 'IdFoto', canal: 0 },
  { columna: 'IdFoto1', canal: 1 },
  { columna: 'IdFoto2', canal: 2 },
  { columna: 'IdFoto3', canal: 3 },
];

/**
 * Galería de Consola: fotos guardadas (`Posiciones.IdFoto/IdFoto1..3` → `Fotos`)
 * por cliente, usuario o unidad. Solo lectura.
 *
 * Se consulta desde `Posiciones` (índice `IMEI + FechaHora`) y se une `Fotos`
 * por llave primaria; `Fotos` no tiene índice por IMEI/fecha.
 */
@Injectable()
export class ConsolaGaleriaService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(UsuariosInstalaciones)
    private readonly usuariosInstRepo: Repository<UsuariosInstalaciones>,
    private readonly tenantFilter: TenantFilterService,
    private readonly dataSource: DataSource,
    private readonly alcance: ConsolaAlcanceService,
  ) {}

  /** Tipo de equipo y canales de una unidad, para copiar en cada respuesta. */
  private equipo(inst: EquipoGaleria): EquipoGaleria {
    return {
      idTipoDispositivo: inst.idTipoDispositivo,
      nombreTipoDispositivo: inst.nombreTipoDispositivo,
      canalesActivos: inst.canalesActivos,
    };
  }

  /** Roles que solo ven las unidades asignadas a ellos. */
  private esRolAsignado(rol: number): boolean {
    const r = Number(rol);
    return r === EnumRoles.OPERADOR || r === EnumRoles.USUARIO;
  }

  /**
   * Cliente efectivo según el rol:
   * - 7 / 9: siempre el del token.
   * - 6: el enviado o, si se omite, el del token.
   * - Resto: obligatorio.
   * Siempre se valida contra el alcance del token (403 si queda fuera).
   */
  private async resolverIdCliente(
    rol: number,
    idClienteToken: number,
    idClienteDto?: number,
  ): Promise<number> {
    if (this.esRolAsignado(rol)) {
      return Number(idClienteToken);
    }

    let idCliente = idClienteDto != null ? Number(idClienteDto) : null;
    if (idCliente == null && Number(rol) === EnumRoles.CLIENTE) {
      idCliente = Number(idClienteToken);
    }
    if (idCliente == null || !Number.isFinite(idCliente) || idCliente < 1) {
      throw new BadRequestException('idCliente es obligatorio');
    }

    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('Cliente fuera de alcance');
    }
    return idCliente;
  }

  /**
   * Unidades activas del cliente con dispositivo e IMEI (sin paneles).
   * Roles 7 / 9: solo las asignadas al usuario del token.
   */
  private async cargarInstalaciones(
    idCliente: number,
    rol: number,
    idUsuarioToken: number,
  ): Promise<{ nombreCliente: string | null; instalaciones: InstalacionGaleriaItem[] }> {
    const qb = this.qbInstalacionesGaleria(rol, idUsuarioToken);
    qb.andWhere('i.idCliente = :idCliente', { idCliente }).orderBy('i.id', 'ASC');

    const rows = await qb.getRawMany<Record<string, unknown>>();
    let nombreCliente: string | null = null;
    const instalaciones: InstalacionGaleriaItem[] = [];

    for (const row of rows) {
      const fila = this.mapFilaInstalacion(row);
      if (!fila) continue;
      nombreCliente ??= fila.nombreCliente;
      instalaciones.push(fila.inst);
    }
    return { nombreCliente, instalaciones };
  }

  /**
   * Unidades activas con dispositivo (base de la Galería). Roles 7 / 9: solo las
   * asignadas al usuario del token. El filtro de cliente lo agrega quien llama.
   */
  private qbInstalacionesGaleria(
    rol: number,
    idUsuarioToken: number,
  ): SelectQueryBuilder<Instalaciones> {
    const qb = this.instalacionesRepo.createQueryBuilder('i');
    applyPaginadoBaseJoins(qb);
    applyPaginadoSelectBase(qb);
    applyPaginadoTodosTiposProducto(qb);
    // Canales TrackCam (solo existe config para tipo 5; AVL queda en null).
    qb.leftJoin(
      TrackcamConfig,
      'tcGal',
      'tcGal.idDispositivo = d.id AND tcGal.idCliente = d.idCliente',
    )
      .addSelect('tcGal.canal1Activo', 'canal1Activo')
      .addSelect('tcGal.canal2Activo', 'canal2Activo')
      .addSelect('tcGal.canal3Activo', 'canal3Activo');
    qb.where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO }).andWhere(
      'i.idDispositivo IS NOT NULL',
    );

    if (this.esRolAsignado(rol)) {
      qb.innerJoin(
        UsuariosInstalaciones,
        'uiTok',
        'uiTok.idInstalacion = i.id AND uiTok.idUsuario = :idUsuarioToken AND uiTok.estatus = :uiActivo',
        { idUsuarioToken, uiActivo: EstatusEnum.ACTIVO },
      );
    }
    return qb;
  }

  /** Fila de `qbInstalacionesGaleria` → unidad de la Galería (null si no tiene IMEI o es panel). */
  private mapFilaInstalacion(row: Record<string, unknown>): {
    idCliente: number;
    nombreCliente: string | null;
    inst: InstalacionGaleriaItem;
  } | null {
    const plano = mapInstalacionPaginadaPlana(row) as Record<string, unknown>;

    const imei = typeof plano.imeiDispositivo === 'string' ? plano.imeiDispositivo.trim() : '';
    const idTipoDispositivo =
      plano.idTipoDispositivo != null ? Number(plano.idTipoDispositivo) : null;
    if (!imei || idTipoDispositivo === EnumTipoDispositivo.PANEL_ALARMA) return null;

    const base = {
      imei,
      placas: (plano.placaVehiculo as string | null) ?? null,
      economico: (plano.ecoVehiculo as string | null) ?? null,
      descripcion: (plano.nombreProducto as string | null) ?? null,
    };
    return {
      idCliente: Number(plano.idCliente ?? row.idCliente),
      nombreCliente: (plano.nombreCliente as string | null) ?? null,
      inst: {
        idInstalacion: Number(plano.id),
        etiqueta: etiquetaInstalacion(base),
        ...base,
        idTipoProducto:
          plano.idTipoProducto != null ? Number(plano.idTipoProducto) : null,
        nombreTipoProducto: (plano.nombreTipoProducto as string | null) ?? null,
        marca: (plano.nombreMarcaVehiculo as string | null) ?? null,
        modelo: (plano.nombreModeloVehiculo as string | null) ?? null,
        anio: plano.anioVehiculo != null ? Number(plano.anioVehiculo) : null,
        color: (plano.colorVehiculo as string | null) ?? null,
        idTipoDispositivo,
        nombreTipoDispositivo: (plano.nombreTipoDispositivo as string | null) ?? null,
        canalesActivos:
          idTipoDispositivo === EnumTipoDispositivo.TRACKCAM
            ? canalesActivosDesdeFila(row)
            : [],
        camara: plano.camara != null ? Number(plano.camara) : null,
        idsUsuario: [],
      },
    };
  }

  /**
   * Limita el query al alcance de clientes del rol (1–5, 8: todos; 6: jerarquía; 7/9: el suyo).
   * Devuelve false si el rol no tiene clientes visibles.
   */
  private async aplicarAlcanceClientes(
    qb: SelectQueryBuilder<Instalaciones>,
    rol: number,
    idClienteToken: number,
  ): Promise<boolean> {
    const scope = await this.tenantFilter.idsClientePermitidos(rol, idClienteToken);
    if (scope === 'all') return true;
    if (!scope.length) return false;
    qb.andWhere('i.idCliente IN (:...idsClienteScope)', { idsClienteScope: scope });
    return true;
  }

  /**
   * Asignaciones activas (UsuariosInstalaciones) de usuarios activos del mismo
   * cliente. Llena `idsUsuario` de cada unidad y devuelve los usuarios.
   */
  private async cargarAsignaciones(
    idCliente: number,
    instalaciones: InstalacionGaleriaItem[],
    soloUsuario: number | null,
  ): Promise<UsuarioGaleriaItem[]> {
    if (!instalaciones.length) return [];

    const qb = this.usuariosInstRepo
      .createQueryBuilder('ui')
      .innerJoin(
        Usuarios,
        'u',
        'u.id = ui.idUsuario AND u.idCliente = :idCliente AND u.estatus = :activo',
        { idCliente, activo: EstatusEnum.ACTIVO },
      )
      .select('ui.idInstalacion', 'idInstalacion')
      .addSelect('u.id', 'idUsuario')
      .addSelect('u.nombre', 'nombre')
      .addSelect('u.apellidoPaterno', 'apellidoPaterno')
      .addSelect('u.apellidoMaterno', 'apellidoMaterno')
      .addSelect('u.userName', 'userName')
      .where('ui.idInstalacion IN (:...ids)', {
        ids: instalaciones.map((i) => i.idInstalacion),
      })
      .andWhere('ui.estatus = :uiActivo', { uiActivo: EstatusEnum.ACTIVO });
    if (soloUsuario != null) {
      qb.andWhere('u.id = :soloUsuario', { soloUsuario });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    const porInstalacion = new Map(instalaciones.map((i) => [i.idInstalacion, i]));
    const usuarios = new Map<number, UsuarioGaleriaItem>();

    for (const row of rows) {
      const idUsuario = Number(row.idUsuario);
      const inst = porInstalacion.get(Number(row.idInstalacion));
      if (!inst || !Number.isFinite(idUsuario)) continue;
      if (!inst.idsUsuario.includes(idUsuario)) inst.idsUsuario.push(idUsuario);

      const actual = usuarios.get(idUsuario);
      if (actual) {
        actual.totalInstalaciones += 1;
        continue;
      }
      const nombre =
        [row.nombre, row.apellidoPaterno, row.apellidoMaterno]
          .filter((v) => typeof v === 'string' && v.trim())
          .join(' ')
          .trim() || String(row.userName ?? `Usuario #${idUsuario}`);
      usuarios.set(idUsuario, { id: idUsuario, nombre, totalInstalaciones: 1 });
    }

    return [...usuarios.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
    );
  }

  /** GET /consola/galeria/filtros — usuarios + unidades del cliente para los selectores. */
  async filtros(
    idClienteDto: number | undefined,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: FiltrosGaleriaResult }> {
    try {
      const idCliente = await this.resolverIdCliente(rol, idClienteToken, idClienteDto);
      const { nombreCliente, instalaciones } = await this.cargarInstalaciones(
        idCliente,
        rol,
        idUsuarioToken,
      );
      const usuarios = await this.cargarAsignaciones(
        idCliente,
        instalaciones,
        this.esRolAsignado(rol) ? Number(idUsuarioToken) : null,
      );
      return { data: { idCliente, nombreCliente, usuarios, instalaciones } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Cliente, periodo y unidades a consultar según rol + filtros opcionales.
   * Compartido por `consultar` y `resumen` para que ambos vean lo mismo.
   */
  private async resolverAlcance(
    dto: ResumenGaleriaDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{
    idCliente: number;
    nombreCliente: string | null;
    fechaInicio: string;
    fechaFinal: string;
    alcance: InstalacionGaleriaItem[];
  }> {
    const idCliente = await this.resolverIdCliente(rol, idClienteToken, dto.idCliente);

    let fechaInicio: string;
    let fechaFinal: string;
    try {
      fechaInicio = parseFechaHistorico(dto.fechaInicio);
      fechaFinal = parseFechaHistorico(dto.fechaFinal);
    } catch {
      throw new BadRequestException('fechaInicio / fechaFinal tienen un formato inválido');
    }
    const errorRango = validarRangoGaleria(fechaInicio, fechaFinal);
    if (errorRango) throw new BadRequestException(errorRango);

    const { nombreCliente, instalaciones } = await this.cargarInstalaciones(
      idCliente,
      rol,
      idUsuarioToken,
    );
    let alcance = instalaciones;

    const idsUsuario = [...new Set((dto.idsUsuario ?? []).map(Number))];
    if (idsUsuario.length) {
      await this.cargarAsignaciones(
        idCliente,
        alcance,
        this.esRolAsignado(rol) ? Number(idUsuarioToken) : null,
      );
      const conocidos = new Set(alcance.flatMap((i) => i.idsUsuario));
      if (idsUsuario.some((id) => !conocidos.has(id))) {
        throw new BadRequestException(
          'Uno o más usuarios no existen, no pertenecen al cliente o no tienen unidades asignadas',
        );
      }
      alcance = alcance.filter((i) => i.idsUsuario.some((u) => idsUsuario.includes(u)));
    }

    const idsInstalacion = [...new Set((dto.idsInstalacion ?? []).map(Number))];
    if (idsInstalacion.length) {
      const visibles = new Set(alcance.map((i) => i.idInstalacion));
      if (idsInstalacion.some((id) => !visibles.has(id))) {
        throw new ForbiddenException('Una o más unidades están fuera de alcance');
      }
      alcance = alcance.filter((i) => idsInstalacion.includes(i.idInstalacion));
    }

    return { idCliente, nombreCliente, fechaInicio, fechaFinal, alcance };
  }

  /**
   * POST /consola/galeria/resumen — unidades con fotos en el periodo (secciones),
   * con su total de capturas y la fecha de la más reciente. Una sola consulta agrupada.
   */
  async resumen(
    dto: ResumenGaleriaDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: ResumenGaleriaResult }> {
    try {
      const { idCliente, nombreCliente, fechaInicio, fechaFinal, alcance } =
        await this.resolverAlcance(dto, idUsuarioToken, idClienteToken, rol);

      const base = { idCliente, nombreCliente, fechaInicio, fechaFinal };
      if (!alcance.length) {
        return { data: { ...base, totalCapturas: 0, totalUnidades: 0, unidades: [] } };
      }

      const porImei = new Map(alcance.map((i) => [i.imei, i]));
      const rows = await this.baseConsultaFotos([...porImei.keys()], fechaInicio, fechaFinal)
        .select('CAST(p.imei AS CHAR)', 'imei')
        .addSelect('COUNT(*)', 'totalCapturas')
        .addSelect('MAX(p.fechaHora)', 'ultimaCaptura')
        .groupBy('p.imei')
        .getRawMany<{ imei: string; totalCapturas: string | number; ultimaCaptura: unknown }>();

      const unidades: UnidadGaleriaResumenItem[] = [];
      for (const row of rows) {
        const inst = porImei.get(String(row.imei ?? '').trim());
        const totalCapturas = Number(row.totalCapturas);
        if (!inst || !totalCapturas) continue;
        unidades.push({
          idInstalacion: inst.idInstalacion,
          etiqueta: inst.etiqueta,
          imei: inst.imei,
          placas: inst.placas,
          economico: inst.economico,
          descripcion: inst.descripcion,
          idTipoProducto: inst.idTipoProducto,
          nombreTipoProducto: inst.nombreTipoProducto,
          marca: inst.marca,
          modelo: inst.modelo,
          anio: inst.anio,
          color: inst.color,
          ...this.equipo(inst),
          totalCapturas,
          ultimaCaptura: formatFechaPosicion(row.ultimaCaptura as string | Date | null),
        });
      }
      // Unidad con la captura más reciente primero; empate por etiqueta.
      unidades.sort(
        (a, b) =>
          String(b.ultimaCaptura ?? '').localeCompare(String(a.ultimaCaptura ?? '')) ||
          a.etiqueta.localeCompare(b.etiqueta, 'es', { sensitivity: 'base' }),
      );

      return {
        data: {
          ...base,
          totalCapturas: unidades.reduce((s, u) => s + u.totalCapturas, 0),
          totalUnidades: unidades.length,
          unidades,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /** POST /consola/galeria — capturas con foto, paginadas, más recientes primero. */
  async consultar(
    dto: ConsultaGaleriaDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: CapturaGaleriaItem[]; paginated: Paginated }> {
    try {
      const { fechaInicio, fechaFinal, alcance } = await this.resolverAlcance(
        dto,
        idUsuarioToken,
        idClienteToken,
        rol,
      );

      const page = Math.max(1, Math.trunc(Number(dto.page) || 1));
      const limit = Math.min(100, Math.max(1, Math.trunc(Number(dto.limit) || LIMIT_DEFAULT)));
      const vacio = {
        data: [] as CapturaGaleriaItem[],
        paginated: { total: 0, page, limit, totalPages: 0 },
      };

      if (!alcance.length) return vacio;

      const porImei = new Map(alcance.map((i) => [i.imei, i]));
      const imeis = [...porImei.keys()];

      const total = Number(
        (
          await this.baseConsultaFotos(imeis, fechaInicio, fechaFinal)
            .select('COUNT(*)', 'total')
            .getRawOne<{ total: string | number }>()
        )?.total ?? 0,
      );
      if (!total) return vacio;

      const rows = await this.baseConsultaFotos(imeis, fechaInicio, fechaFinal)
        .select('p.id', 'idPosicion')
        .addSelect('CAST(p.imei AS CHAR)', 'imei')
        .addSelect('p.fechaHora', 'fechaHora')
        .addSelect('p.lat', 'lat')
        .addSelect('p.lng', 'lng')
        .addSelect('p.velocidad', 'velocidad')
        .addSelect('p.idFoto', 'idFoto0')
        .addSelect('f0.ruta', 'rutaFoto0')
        .addSelect('p.idFoto1', 'idFoto1')
        .addSelect('f1.ruta', 'rutaFoto1')
        .addSelect('p.idFoto2', 'idFoto2')
        .addSelect('f2.ruta', 'rutaFoto2')
        .addSelect('p.idFoto3', 'idFoto3')
        .addSelect('f3.ruta', 'rutaFoto3')
        .orderBy('p.fechaHora', 'DESC')
        .addOrderBy('p.id', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<Record<string, unknown>>();

      const data: CapturaGaleriaItem[] = [];
      for (const row of rows) {
        const inst = porImei.get(String(row.imei ?? '').trim());
        if (!inst) continue;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        const velocidad = Number(row.velocidad);
        data.push({
          idPosicion: Number(row.idPosicion),
          idInstalacion: inst.idInstalacion,
          etiqueta: inst.etiqueta,
          imei: inst.imei,
          placas: inst.placas,
          economico: inst.economico,
          descripcion: inst.descripcion,
          fechaHora: formatFechaPosicion(row.fechaHora as string | Date | null),
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          velocidad: Number.isFinite(velocidad) ? velocidad : null,
          ...this.equipo(inst),
          fotos: extraerFotosPosicion(row).map((foto) => ({
            ...foto,
            ...resolverCanalFoto(foto.canal, inst.idTipoDispositivo, inst.canalesActivos),
          })),
        });
      }

      return {
        data,
        paginated: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Posiciones del periodo con al menos una foto existente en `Fotos`.
   * Filtra por `IMEI IN + FechaHora BETWEEN` (usa `IX_Posiciones_Imei_Fecha`).
   */
  private baseConsultaFotos(
    imeis: string[],
    fechaInicio: string,
    fechaFinal: string,
  ): SelectQueryBuilder<Posiciones> {
    return this.posicionesRepo
      .createQueryBuilder('p')
      .leftJoin(Fotos, 'f0', 'f0.id = p.idFoto')
      .leftJoin(Fotos, 'f1', 'f1.id = p.idFoto1')
      .leftJoin(Fotos, 'f2', 'f2.id = p.idFoto2')
      .leftJoin(Fotos, 'f3', 'f3.id = p.idFoto3')
      .where('p.imei IN (:...imeis)', { imeis })
      .andWhere('p.fechaHora BETWEEN :fechaInicio AND :fechaFinal', {
        fechaInicio,
        fechaFinal,
      })
      .andWhere(
        '(f0.ruta IS NOT NULL OR f1.ruta IS NOT NULL OR f2.ruta IS NOT NULL OR f3.ruta IS NOT NULL)',
      );
  }

  /**
   * POST /consola/galeria/imei — fotos paginadas de un equipo por IMEI.
   * Una fila por foto (UNION de los 4 canales). Solo si la unidad activa
   * está dentro del alcance del token. 404 idéntico si no existe o no hay acceso.
   */
  async fotosPorImei(
    dto: FotosImeiDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<FotosImeiResult> {
    try {
      const imei = String(dto.imei ?? '').trim();
      const page = Math.max(1, Math.trunc(Number(dto.page) || 1));
      const limit = Math.min(
        100,
        Math.max(1, Math.trunc(Number(dto.limit) || LIMIT_DEFAULT_IMEI)),
      );

      let fechaInicio: string;
      let fechaFinal: string;
      if (dto.fechaInicio == null && dto.fechaFinal == null) {
        ({ fechaInicio, fechaFinal } = rangoPorDefectoMesActual(new Date()));
      } else if (dto.fechaInicio == null || dto.fechaFinal == null) {
        throw new BadRequestException(
          'fechaInicio y fechaFinal deben enviarse juntas',
        );
      } else {
        try {
          fechaInicio = parseFechaHistorico(dto.fechaInicio);
          fechaFinal = parseFechaHistorico(dto.fechaFinal);
        } catch {
          throw new BadRequestException(
            'fechaInicio / fechaFinal tienen un formato inválido',
          );
        }
      }
      const errorRango = validarRangoGaleria(fechaInicio, fechaFinal);
      if (errorRango) throw new BadRequestException(errorRango);

      const resuelto = await this.alcance.resolverUnidadPorImei(
        imei,
        rol,
        idUsuarioToken,
        idClienteToken,
      );
      if (!resuelto) {
        throw new NotFoundException(MSG_IMEI_NO_ENCONTRADO);
      }
      const { unidad: u, idCliente, idDispositivo, vigenteDesdeInst } =
        resuelto;
      // Misma forma de respuesta que antes del refactor (sin idCliente/nombreCliente).
      const unidad: UnidadFotosImei = {
        idInstalacion: u.idInstalacion,
        imei: u.imei,
        etiqueta: u.etiqueta,
        placas: u.placas,
        economico: u.economico,
        marca: u.marca,
        modelo: u.modelo,
        anio: u.anio,
        descripcion: u.descripcion,
        idTipoDispositivo: u.idTipoDispositivo,
        nombreTipoDispositivo: u.nombreTipoDispositivo,
        canalesActivos: u.canalesActivos,
      };

      // No mostrar fotos de un cliente anterior: inicio ≥ primera vigencia
      // del dispositivo en este cliente (histórico o Instalaciones.VigenteDesde).
      const vigenciaCliente =
        await this.alcance.primeraVigenciaDispositivoEnCliente(
          idCliente,
          idDispositivo,
          vigenteDesdeInst,
        );
      let inicioEfectivo = fechaInicio;
      if (vigenciaCliente && vigenciaCliente > fechaInicio) {
        inicioEfectivo = vigenciaCliente;
      }

      const vacio = (): FotosImeiResult => ({
        unidad,
        fechaInicio,
        fechaFinal,
        data: [],
        paginated: { total: 0, page, limit, totalPages: 0 },
      });

      if (inicioEfectivo > fechaFinal) return vacio();

      const { sqlUnion, paramsRango } = this.sqlUnionFotosImei(
        imei,
        inicioEfectivo,
        fechaFinal,
      );

      const countRows = await this.dataSource.query(
        `SELECT COUNT(*) AS total FROM (${sqlUnion}) t`,
        paramsRango,
      );
      const total = Number(countRows?.[0]?.total ?? 0);
      if (!total) return vacio();

      const rows = await this.dataSource.query(
        `SELECT * FROM (${sqlUnion}) t
         ORDER BY fechaHora DESC, idPosicion DESC, canal ASC
         LIMIT ? OFFSET ?`,
        [...paramsRango, limit, (page - 1) * limit],
      );

      const data: FotoImeiItem[] = [];
      for (const row of rows as Record<string, unknown>[]) {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        const velocidad = Number(row.velocidad);
        const url = typeof row.url === 'string' ? row.url.trim() : '';
        if (!url) continue;
        const slot = Number(row.canal);
        data.push({
          idFoto: Number(row.idFoto),
          idPosicion: Number(row.idPosicion),
          canal: slot,
          ...resolverCanalFoto(slot, unidad.idTipoDispositivo, unidad.canalesActivos),
          url,
          fechaHora: formatFechaPosicion(
            row.fechaHora as string | Date | null,
          ),
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          velocidad: Number.isFinite(velocidad) ? velocidad : null,
        });
      }

      return {
        unidad,
        fechaInicio,
        fechaFinal,
        data,
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * UNION ALL de los 4 slots de foto. Parámetros con `?` (imei, desde, hasta × 4).
   * Usa el índice `IX_Posiciones_Imei_Fecha`.
   */
  private sqlUnionFotosImei(
    imei: string,
    fechaInicio: string,
    fechaFinal: string,
  ): { sqlUnion: string; paramsRango: unknown[] } {
    const partes: string[] = [];
    const paramsRango: unknown[] = [];
    for (const { columna, canal } of SLOTS_FOTO_IMEI) {
      partes.push(`
        SELECT f.Id AS idFoto, p.Id AS idPosicion, ${canal} AS canal, f.Ruta AS url,
               p.FechaHora AS fechaHora, p.Lat AS lat, p.Lng AS lng, p.Velocidad AS velocidad
        FROM Posiciones p
        INNER JOIN Fotos f ON f.Id = p.${columna} AND f.Ruta IS NOT NULL AND f.Ruta <> ''
        WHERE p.Imei = ? AND p.FechaHora BETWEEN ? AND ?
      `);
      paramsRango.push(imei, fechaInicio, fechaFinal);
    }
    return { sqlUnion: partes.join(' UNION ALL '), paramsRango };
  }
}

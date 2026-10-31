import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { TramosInstalacionService } from 'src/motor-activos/tramos-instalacion.service';
import { posicionEnTramos } from 'src/motor-activos/tramos-instalacion';
import { fechaPared } from 'src/utils/datetime-mexico.util';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import {
  EnumModulos,
  EstatusEnum,
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { Incidentes } from 'src/entities/Incidentes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { Productos } from 'src/entities/Productos';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import { Vehiculos } from 'src/entities/Vehiculos';
import {
  isoUtcToMexicoCityMysql,
  nowMexicoCityMysql,
} from 'src/utils/datetime-mexico.util';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { CreateSeguimientoIncidenteDto } from './dto/create-seguimiento-incidente.dto';
import { FinalizarIncidenteDto } from './dto/finalizar-incidente.dto';
import {
  AlcanceAsignacionIncidentes,
  origenVisiblePorAsignacion,
  whereIncidentesAsignados,
} from './incidentes-alcance.util';
import { UpdateIncidenteDto } from './dto/update-incidente.dto';
import {
  snapshotEventoAlarma,
  snapshotPosicion,
} from './map-datos-origen.util';
import {
  imeiIncidente,
  mapIncidentePlano,
  mapSeguimientoPlano,
  nombreIncidente,
  RELACIONES_INCIDENTE_DETALLE,
  RELACIONES_INCIDENTE_LISTA,
  UnidadIncidente,
} from './map-incidentes.util';

/** `where` de incidentes: una condición o ramas OR (alcance por asignación). */
type WhereIncidentes =
  | FindOptionsWhere<Incidentes>
  | FindOptionsWhere<Incidentes>[];

/** Medios de los seguimientos que guarda el reporte final. */
export const MEDIO_SEGUIMIENTO_RESULTADO = 'Resultado final';
export const MEDIO_SEGUIMIENTO_CIERRE = 'Cierre';

@Injectable()
export class IncidentesService {
  constructor(
    @InjectRepository(Incidentes)
    private readonly repository: Repository<Incidentes>,
    @InjectRepository(SeguimientoIncidentes)
    private readonly seguimientoRepo: Repository<SeguimientoIncidentes>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(EventoAlarma)
    private readonly eventosRepo: Repository<EventoAlarma>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly tramos: TramosInstalacionService,
  ) {}

  /**
   * Unidad (instalación activa) de cada IMEI, en un solo query.
   * Si falla no rompe el listado: las columnas quedan vacías.
   */
  private async unidadesPorImei(
    items: Incidentes[],
  ): Promise<Map<string, UnidadIncidente>> {
    const mapa = new Map<string, UnidadIncidente>();
    const imeis = [
      ...new Set(
        items
          .map((item) => imeiIncidente(item))
          .filter((imei): imei is string => !!imei),
      ),
    ];
    if (!imeis.length) return mapa;

    try {
      const rows = await this.instalacionesRepo
        .createQueryBuilder('i')
        .innerJoin(
          Dispositivos,
          'd',
          'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
        )
        .leftJoin(
          Productos,
          'p',
          'p.id = i.idProducto AND p.idCliente = i.idCliente',
        )
        .leftJoin(
          Vehiculos,
          'v',
          'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
        )
        .leftJoin(CatMarcas, 'mar', 'mar.id = v.idMarcaVehiculo')
        .leftJoin(CatModelos, 'mod', 'mod.id = v.idModeloVehiculo')
        .select('CAST(d.imei AS CHAR)', 'imei')
        .addSelect('i.id', 'idInstalacion')
        .addSelect('v.numeroEconomico', 'economico')
        .addSelect('v.placa', 'placas')
        .addSelect('mar.nombre', 'marca')
        .addSelect('mod.nombre', 'modelo')
        .addSelect('p.nombre', 'nombreProducto')
        .where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
        .andWhere('CAST(d.imei AS CHAR) IN (:...imeis)', { imeis })
        .orderBy('i.id', 'DESC')
        .getRawMany<Record<string, unknown>>();

      const texto = (v: unknown): string | null => {
        const s = v == null ? '' : String(v).trim();
        return s || null;
      };
      for (const row of rows) {
        const imei = texto(row.imei);
        if (!imei || mapa.has(imei)) continue;
        const idInstalacion = Number(row.idInstalacion);
        mapa.set(imei, {
          idInstalacion: Number.isFinite(idInstalacion) ? idInstalacion : null,
          economico: texto(row.economico),
          placas: texto(row.placas),
          marca: texto(row.marca),
          modelo: texto(row.modelo),
          nombreProducto: texto(row.nombreProducto),
        });
      }
    } catch {
      // Datos de unidad son opcionales; el listado sigue sin ellos.
    }
    return mapa;
  }

  private async mapConUnidad(
    items: Incidentes[],
    incluirSeguimientos = false,
  ) {
    const unidades = await this.unidadesPorImei(items);
    return items.map((item) => {
      const imei = imeiIncidente(item);
      return mapIncidentePlano(
        item,
        incluirSeguimientos,
        imei ? (unidades.get(imei) ?? null) : null,
      );
    });
  }

  private async assertClienteExiste(idCliente: number): Promise<void> {
    const cliente = await this.clientesRepo.findOne({
      where: { id: idCliente },
    });
    if (!cliente) {
      throw new BadRequestException('IdCliente no existe');
    }
  }

  private async assertClienteEnAlcance(
    idCliente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('Cliente fuera de alcance');
    }
  }

  /**
   * Roles 7/9 (F5): equipos de sus instalaciones asignadas (vigentes) en
   * `UsuariosInstalaciones`. `null` = el rol no se limita por asignación
   * (solo por cliente). Ver supuestos en `incidentes-alcance.util.ts`.
   */
  private async alcanceAsignacion(
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<AlcanceAsignacionIncidentes | null> {
    const asignadas = await this.tenantFilter.idsInstalacionAsignadas({
      userId: idUsuario,
      idCliente: idClienteToken,
      rol,
    });
    if (asignadas === 'all') return null;
    if (!asignadas.length) return { imeis: [], idsDispositivo: [] };

    const rows = await this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin(
        Dispositivos,
        'd',
        'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
      )
      .select('d.id', 'idDispositivo')
      .addSelect('CAST(d.imei AS CHAR)', 'imei')
      .where('i.id IN (:...ids)', { ids: asignadas })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .getRawMany<{ idDispositivo: unknown; imei: unknown }>();

    const imeis = new Set<string>();
    const idsDispositivo = new Set<number>();
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (imei) imeis.add(imei);
      const idDispositivo = Number(row.idDispositivo);
      if (Number.isFinite(idDispositivo) && idDispositivo > 0) {
        idsDispositivo.add(idDispositivo);
      }
    }
    return { imeis: [...imeis], idsDispositivo: [...idsDispositivo] };
  }

  /**
   * Limita un `where` a los incidentes de las unidades asignadas (roles 7/9).
   * Demás roles: sin cambio. `null` = no ve ningún incidente.
   */
  private async aplicarAsignacion(
    where: FindOptionsWhere<Incidentes>,
    idUsuario: number,
    idClienteToken: number,
    rol: number,
  ): Promise<WhereIncidentes | null> {
    const alcance = await this.alcanceAsignacion(
      idUsuario,
      idClienteToken,
      rol,
    );
    if (!alcance) return where;
    const ramas = whereIncidentesAsignados(where, alcance);
    return ramas.length ? ramas : null;
  }

  private async findVisibleOrFail(
    id: number,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
    detalle = false,
  ): Promise<Incidentes> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('Incidente no encontrado');
    }

    // Roles 7/9: un incidente de una unidad no asignada → 404.
    const where = await this.aplicarAsignacion(
      {
        id,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      },
      idUsuario,
      idClienteToken,
      rol,
    );
    if (!where) {
      throw new NotFoundException('Incidente no encontrado');
    }

    const entity = await this.repository.findOne({
      where,
      relations: [
        ...(detalle
          ? RELACIONES_INCIDENTE_DETALLE
          : RELACIONES_INCIDENTE_LISTA),
      ],
    });
    if (!entity) {
      throw new NotFoundException('Incidente no encontrado');
    }
    return entity;
  }

  /**
   * Cliente dueño de una posición: el de la instalación en la que estaba el
   * equipo cuando la generó (tramos de vigencia, docs/motor-activos.md §6). Lo
   * que transmitió sin estar instalado, o con otro cliente, no se puede usar
   * como origen de un incidente de este.
   */
  private async idClienteDePosicion(posicion: Posiciones): Promise<number> {
    const imei = imeiToString(posicion.imei);
    if (!imei) {
      throw new BadRequestException(
        'La posición no tiene IMEI válido para resolver el cliente',
      );
    }

    const dispositivo = await this.dispositivosRepo
      .createQueryBuilder('d')
      .select('d.id', 'id')
      .where('d.imei = :imei', { imei })
      .getRawOne<{ id: string | number }>();
    const idDispositivo = Number(dispositivo?.id);
    if (!Number.isFinite(idDispositivo) || idDispositivo < 1) {
      throw new BadRequestException(
        'La posición no tiene un dispositivo asociado',
      );
    }

    const candidatas = await this.instalacionesConDispositivo(idDispositivo);
    const tramos = [...(await this.tramos.tramosDe(candidatas)).values()].flat();
    const fechaHora = fechaPared(new Date(posicion.fechaHora));
    const tramo = tramos.find((t) => posicionEnTramos([t], imei, fechaHora));
    if (!tramo) {
      throw new BadRequestException(
        'La posición no corresponde a una instalación del equipo: se generó cuando no estaba instalado.',
      );
    }
    const inst = await this.instalacionesRepo.findOne({
      where: { id: tramo.idInstalacion },
      select: { id: true, idCliente: true },
    });
    return Number(inst!.idCliente);
  }

  /**
   * Instalaciones (vigentes o dadas de baja) que tuvieron el dispositivo en
   * alguna versión: la fila actual o su cadena en HistoricoInstalaciones. Un
   * cambio de componente borra la fila anterior, así que la cadena se sigue
   * hacia adelante hasta la fila que la enlaza.
   */
  private async instalacionesConDispositivo(idDispositivo: number): Promise<number[]> {
    const manager = this.dataSource.manager;
    const ids = new Set<number>(
      (
        await manager.find(Instalaciones, {
          where: { idDispositivo },
          select: { id: true },
        })
      ).map((i) => Number(i.id)),
    );
    let frontera = (
      await manager.find(HistoricoInstalaciones, {
        where: { idDispositivo },
        select: { id: true, idInstalacionOriginal: true },
      })
    );
    const visitados = new Set<number>();
    while (frontera.length) {
      const hist = frontera.map((h) => Number(h.id)).filter((h) => !visitados.has(h));
      if (!hist.length) break;
      hist.forEach((h) => visitados.add(h));
      // Una baja archivada conserva la fila original.
      const originales = frontera
        .map((h) => (h.idInstalacionOriginal != null ? Number(h.idInstalacionOriginal) : null))
        .filter((o): o is number => o != null);
      const filas = await manager.find(Instalaciones, {
        where: [
          { idHistoricoInstalacion: In(hist) },
          ...(originales.length ? [{ id: In(originales) }] : []),
        ],
        select: { id: true },
      });
      filas.forEach((f) => ids.add(Number(f.id)));
      frontera = await manager.find(HistoricoInstalaciones, {
        where: { idHistoricoInstalacion: In(hist) },
        select: { id: true, idInstalacionOriginal: true },
      });
    }
    return [...ids];
  }

  private async resolverOrigen(dto: CreateIncidenteDto): Promise<{
    tipoOrigen: TipoOrigenIncidente;
    idCliente: number;
    idPosicion: number | null;
    idPosicionOrigen: number | null;
    idEventoAlarma: number | null;
    idEventoAlarmaOrigen: number | null;
    datosOrigen: Record<string, unknown>;
  }> {
    const tipoOrigen = Number(dto.tipoOrigen) as TipoOrigenIncidente;

    if (tipoOrigen === TipoOrigenIncidente.POSICION) {
      if (dto.idEventoAlarma != null) {
        throw new BadRequestException(
          'idEventoAlarma no aplica cuando tipoOrigen es POSICION',
        );
      }
      if (dto.idPosicion == null) {
        throw new BadRequestException(
          'idPosicion es obligatorio cuando tipoOrigen es POSICION',
        );
      }

      const posicion = await this.posicionesRepo.findOne({
        where: { id: dto.idPosicion },
      });
      if (!posicion) {
        throw new NotFoundException('Posición no encontrada');
      }

      const idPosicion = Number(posicion.id);
      return {
        tipoOrigen,
        idCliente: await this.idClienteDePosicion(posicion),
        idPosicion,
        idPosicionOrigen: idPosicion,
        idEventoAlarma: null,
        idEventoAlarmaOrigen: null,
        datosOrigen: snapshotPosicion(posicion),
      };
    }

    if (tipoOrigen === TipoOrigenIncidente.EVENTO_ALARMA) {
      if (dto.idPosicion != null) {
        throw new BadRequestException(
          'idPosicion no aplica cuando tipoOrigen es EVENTO_ALARMA',
        );
      }
      if (dto.idEventoAlarma == null) {
        throw new BadRequestException(
          'idEventoAlarma es obligatorio cuando tipoOrigen es EVENTO_ALARMA',
        );
      }

      const evento = await this.eventosRepo.findOne({
        where: { id: dto.idEventoAlarma },
      });
      if (!evento) {
        throw new NotFoundException('Evento de alarma no encontrado');
      }

      const idCliente = Number(evento.idCliente);
      if (!Number.isFinite(idCliente) || idCliente < 1) {
        throw new BadRequestException(
          'El evento de alarma no tiene cliente asignado',
        );
      }

      const idEventoAlarma = Number(evento.id);
      return {
        tipoOrigen,
        idCliente,
        idPosicion: null,
        idPosicionOrigen: null,
        idEventoAlarma,
        idEventoAlarmaOrigen: idEventoAlarma,
        datosOrigen: snapshotEventoAlarma(evento),
      };
    }

    throw new BadRequestException('tipoOrigen inválido');
  }

  private parseFechaHora(raw?: string): string | undefined {
    if (raw == null || raw.trim() === '') {
      return undefined;
    }
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      const normalizada = s.includes('T') ? s.replace('T', ' ') : s;
      return normalizada.length === 16 ? `${normalizada}:00` : normalizada;
    }
    try {
      return isoUtcToMexicoCityMysql(s);
    } catch {
      throw new BadRequestException('fechaHora tiene un formato inválido');
    }
  }

  private async whereListado(
    idClienteToken: number,
    rol: number,
    idUsuario: number,
    idClienteFiltro?: number,
    tipoOrigen?: number,
    soloAbiertos = false,
    estatus?: number,
  ): Promise<WhereIncidentes | null> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return null;
    }

    let idClienteWhere = tenant.idCliente;
    if (idClienteFiltro != null) {
      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteFiltro)) {
        return null;
      }
      idClienteWhere = idClienteFiltro;
    }

    const estatusWhere = soloAbiertos ? EstatusIncidente.ABIERTO : estatus;
    return this.aplicarAsignacion(
      {
        ...(estatusWhere != null ? { estatus: estatusWhere } : {}),
        ...(tipoOrigen != null ? { tipoOrigen } : {}),
        ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
      },
      idUsuario,
      idClienteToken,
      rol,
    );
  }

  async create(
    dto: CreateIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const origen = await this.resolverOrigen(dto);
      await this.assertClienteEnAlcance(
        origen.idCliente,
        idClienteToken,
        rol,
      );
      // Roles 7/9: solo sobre unidades asignadas.
      const alcance = await this.alcanceAsignacion(idUser, idClienteToken, rol);
      if (
        alcance &&
        !origenVisiblePorAsignacion(
          origen.tipoOrigen,
          origen.datosOrigen,
          alcance,
        )
      ) {
        throw new ForbiddenException('Unidad fuera de alcance');
      }

      const entity = this.repository.create({
        idCliente: origen.idCliente,
        tipoOrigen: origen.tipoOrigen,
        idPosicion: origen.idPosicion,
        idPosicionOrigen: origen.idPosicionOrigen,
        idEventoAlarma: origen.idEventoAlarma,
        idEventoAlarmaOrigen: origen.idEventoAlarmaOrigen,
        datosOrigen: origen.datosOrigen,
        idUsuario: Number.isFinite(idUser) && idUser > 0 ? idUser : null,
        descripcion: dto.descripcion?.trim() || null,
        estatus: EstatusIncidente.ABIERTO,
        fechaCierre: null,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se creó el incidente ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente: origen.idCliente, tipoOrigen: origen.tipoOrigen },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Incidente creado correctamente',
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        'Error al crear incidente',
        'CREATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(
    idClienteToken: number,
    rol: number,
    idUsuario: number,
    idClienteFiltro?: number,
    tipoOrigen?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where = await this.whereListado(
        idClienteToken,
        rol,
        idUsuario,
        idClienteFiltro,
        tipoOrigen,
        true,
      );
      if (!where) {
        return { data: [] };
      }

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_INCIDENTE_LISTA],
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return { data: await this.mapConUnidad(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findByIdCliente(
    idCliente: number,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
    tipoOrigen?: number,
  ): Promise<ApiResponseCommon> {
    try {
      await this.assertClienteExiste(idCliente);
      await this.assertClienteEnAlcance(idCliente, idClienteToken, rol);

      const where = await this.aplicarAsignacion(
        {
          idCliente,
          estatus: EstatusIncidente.ABIERTO,
          ...(tipoOrigen != null ? { tipoOrigen } : {}),
        },
        idUsuario,
        idClienteToken,
        rol,
      );
      if (!where) {
        return { data: [] };
      }

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_INCIDENTE_LISTA],
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return { data: await this.mapConUnidad(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idClienteToken: number,
    rol: number,
    idUsuario: number,
    page: number,
    limit: number,
    tipoOrigen?: number,
    estatus?: number,
    idClienteFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where = await this.whereListado(
        idClienteToken,
        rol,
        idUsuario,
        idClienteFiltro,
        tipoOrigen,
        false,
        estatus,
      );
      if (!where) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_INCIDENTE_LISTA],
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return {
        data: await this.mapConUnidad(data),
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

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: ReturnType<typeof mapIncidentePlano> }> {
    const entity = await this.findVisibleOrFail(
      id,
      idClienteToken,
      rol,
      idUsuario,
      true,
    );
    const [data] = await this.mapConUnidad([entity], true);
    return { data };
  }

  /**
   * Finaliza el reporte: guarda descripción / resultado / conclusión, cierra
   * (estatus 0 + fechaCierre) y desde ese momento ya no admite seguimientos.
   * Todo en una transacción. Si ya estaba cerrado → 400.
   */
  async finalizar(
    id: number,
    dto: FinalizarIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(
        id,
        idClienteToken,
        rol,
        idUser,
      );
      if (Number(entity.estatus) !== EstatusIncidente.ABIERTO) {
        throw new BadRequestException('El reporte ya fue finalizado');
      }

      const idUsuario = Number.isFinite(idUser) && idUser > 0 ? idUser : null;
      const ahora = nowMexicoCityMysql();
      const resultado = dto.resultado?.trim();
      const conclusion = dto.conclusion?.trim();

      await this.dataSource.transaction(async (manager) => {
        const seguimientos: Partial<SeguimientoIncidentes>[] = [];
        if (resultado) {
          seguimientos.push({
            actividad: resultado,
            medio: MEDIO_SEGUIMIENTO_RESULTADO,
          });
        }
        if (conclusion) {
          seguimientos.push({
            actividad: conclusion,
            medio: MEDIO_SEGUIMIENTO_CIERRE,
          });
        }
        for (const s of seguimientos) {
          await manager.save(
            manager.create(SeguimientoIncidentes, {
              ...s,
              idIncidente: Number(entity.id),
              idUsuario,
              estatus: EstatusIncidente.ABIERTO,
              fechaHora: ahora as unknown as Date,
            }),
          );
        }

        await manager.update(
          Incidentes,
          { id: entity.id, estatus: EstatusIncidente.ABIERTO },
          {
            estatus: EstatusIncidente.CERRADO,
            fechaCierre: ahora as unknown as Date,
            ...(dto.descripcion !== undefined
              ? { descripcion: dto.descripcion.trim() || null }
              : {}),
          },
        );
      });

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se finalizó el reporte del incidente ID: ${entity.id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Reporte finalizado correctamente',
        estatus: { estatus: EstatusIncidente.CERRADO },
        data: { id: Number(entity.id), nombre: nombreIncidente(entity) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al finalizar el incidente ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdateIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(
        id,
        idClienteToken,
        rol,
        idUser,
      );
      if (dto.descripcion !== undefined) {
        entity.descripcion = dto.descripcion?.trim() || null;
      }
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se actualizó el incidente ID: ${saved.id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Incidente actualizado correctamente',
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al actualizar incidente ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(
        id,
        idClienteToken,
        rol,
        idUser,
      );
      const estatusAnterior =
        Number(entity.estatus) === EstatusIncidente.ABIERTO
          ? EstatusIncidente.ABIERTO
          : EstatusIncidente.CERRADO;
      const estatus =
        estatusAnterior === EstatusIncidente.ABIERTO
          ? EstatusIncidente.CERRADO
          : EstatusIncidente.ABIERTO;

      entity.estatus = estatus;
      entity.fechaCierre =
        estatus === EstatusIncidente.CERRADO
          ? (nowMexicoCityMysql() as unknown as Date)
          : null;

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se cambió estatus del incidente ID: ${saved.id} → ${estatus}`,
        'UPDATE',
        { estatusAnterior, estatus },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al cambiar estatus del incidente ID: ${id}`,
        'UPDATE',
        {},
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async createSeguimiento(
    idIncidente: number,
    dto: CreateSeguimientoIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const incidente = await this.findVisibleOrFail(
        idIncidente,
        idClienteToken,
        rol,
        idUser,
      );
      if (Number(incidente.estatus) !== EstatusIncidente.ABIERTO) {
        throw new BadRequestException(
          'El reporte ya fue finalizado; no admite más seguimientos',
        );
      }

      const fechaHora = this.parseFechaHora(dto.fechaHora);
      const entity = this.seguimientoRepo.create({
        idIncidente: Number(incidente.id),
        idUsuario: Number.isFinite(idUser) && idUser > 0 ? idUser : null,
        actividad: dto.actividad.trim(),
        medio: dto.medio?.trim() || null,
        estatus: EstatusIncidente.ABIERTO,
        ...(fechaHora != null ? { fechaHora: fechaHora as unknown as Date } : {}),
      });

      const saved = await this.seguimientoRepo.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se registró seguimiento ID: ${saved.id} en incidente ${incidente.id}`,
        'CREATE',
        { dto, idIncidente },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Seguimiento registrado correctamente',
        data: { id: Number(saved.id), nombre: saved.actividad },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al registrar seguimiento en incidente ID: ${idIncidente}`,
        'CREATE',
        { dto, idIncidente },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findSeguimientos(
    idIncidente: number,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<ApiResponseCommon> {
    await this.findVisibleOrFail(
      idIncidente,
      idClienteToken,
      rol,
      idUsuario,
    );
    const data = await this.seguimientoRepo.find({
      where: { idIncidente },
      relations: ['idUsuario2'],
      order: { fechaHora: 'ASC', id: 'ASC' },
    });
    return { data: data.map((item) => mapSeguimientoPlano(item)) };
  }
}

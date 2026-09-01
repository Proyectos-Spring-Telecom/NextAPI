import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { Productos } from 'src/entities/Productos';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateInstalacionesDto } from './dto/create-instalaciones.dto';
import { UpdateInstalacionesDto } from './dto/update-instalaciones.dto';
import { BajaInstalacionDto } from './dto/baja-instalacion.dto';
import { FilterInstalacionesPaginadoDto } from './dto/filter-instalaciones-paginado.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumAccionHistoricoInstalacion,
  EnumEstatusInstalacion,
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EnumRoles,
  EnumTipoProducto,
  EstatusEnum,
  ESTATUS_INSTALACION_PATCH,
  ESTATUS_INSTALACION_UPDATE_HISTORICO,
  ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
} from 'src/common/estatus.enum';
import {
  mapHistoricoPlano,
  mapInstalacionPlana,
  RELACIONES_INSTALACION_HISTORICO,
} from './map-instalaciones.util';
import {
  applyPaginadoBaseJoins,
  applyPaginadoPorTipoProducto,
  applyPaginadoSelectBase,
  applyPaginadoTodosTiposProducto,
  mapInstalacionPaginadaPlana,
} from './helpers/instalaciones-paginado.helpers';
import {
  applyDetalleJoins,
  applyDetallePorTipoProducto,
  applyDetalleSelectBase,
  mapInstalacionDetallePlana,
} from './helpers/instalaciones-detalle.helpers';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly repository: Repository<Instalaciones>,
    @InjectRepository(HistoricoInstalaciones)
    private readonly historicoRepo: Repository<HistoricoInstalaciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Sims)
    private readonly simsRepo: Repository<Sims>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    @InjectRepository(CatEstatusInstalacion)
    private readonly estatusInstalacionRepo: Repository<CatEstatusInstalacion>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarProducto(
    idProducto: number,
    idCliente: number,
  ): Promise<Productos> {
    const producto = await this.productosRepo.findOne({
      where: { id: idProducto, idCliente },
    });
    if (!producto) {
      throw new BadRequestException(
        'IdProducto no existe o no pertenece al cliente',
      );
    }
    return producto;
  }

  private async validarProductoDisponibleParaAsignar(
    idProducto: number,
    idCliente: number,
  ): Promise<Productos> {
    const producto = await this.validarProducto(idProducto, idCliente);
    if (Number(producto.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'El producto debe estar en estatus activo (disponible)',
      );
    }
    return producto;
  }

  private async validarDispositivoPerteneceCliente(
    idDispositivo: number,
    idCliente: number,
  ): Promise<Dispositivos> {
    const dispositivo = await this.dispositivosRepo.findOne({
      where: { id: idDispositivo, idCliente },
    });
    if (!dispositivo) {
      throw new BadRequestException(
        'IdDispositivo no existe o no pertenece al cliente',
      );
    }
    return dispositivo;
  }

  private async validarDispositivoDisponibleParaAsignar(
    idDispositivo: number,
    idCliente: number,
    excludeInstalacionId?: number,
  ): Promise<Dispositivos> {
    const dispositivo = await this.validarDispositivoPerteneceCliente(
      idDispositivo,
      idCliente,
    );
    if (Number(dispositivo.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'El dispositivo debe estar en estatus activo (disponible)',
      );
    }
    await this.validarDispositivoSinInstalacionActiva(
      idDispositivo,
      idCliente,
      excludeInstalacionId,
    );
    return dispositivo;
  }

  private async validarSimPerteneceCliente(
    idSim: number,
    idCliente: number,
  ): Promise<Sims> {
    const sim = await this.simsRepo.findOne({
      where: { id: idSim, idCliente },
    });
    if (!sim) {
      throw new BadRequestException(
        'IdSim no existe o no pertenece al cliente',
      );
    }
    return sim;
  }

  private async validarSimDisponibleParaAsignar(
    idSim: number,
    idCliente: number,
    excludeInstalacionId?: number,
  ): Promise<Sims> {
    const sim = await this.validarSimPerteneceCliente(idSim, idCliente);
    if (Number(sim.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'El SIM debe estar en estatus activo (disponible)',
      );
    }
    await this.validarSimSinInstalacionActiva(
      idSim,
      idCliente,
      excludeInstalacionId,
    );
    return sim;
  }

  private assertEstatusComponenteAnterior(
    valor: number | undefined,
    campo: string,
  ): EnumEstatusProductoDispositivo {
    if (
      valor === undefined ||
      !ESTATUS_PRODUCTO_DISPOSITIVO_PATCH.includes(
        valor as (typeof ESTATUS_PRODUCTO_DISPOSITIVO_PATCH)[number],
      )
    ) {
      throw new BadRequestException(
        `${campo} es obligatorio (0–5) cuando ese recurso sale de la instalación`,
      );
    }
    return valor as EnumEstatusProductoDispositivo;
  }

  /** Aplica el mismo estatus numérico a producto, dispositivo y SIM de la instalación. */
  private async sincronizarEstatusComponentes(
    manager: EntityManager,
    instalacion: {
      idCliente: number;
      idProducto: number;
      idDispositivo: number | null;
      idSim: number | null;
    },
    estatus: number,
  ): Promise<void> {
    const idCliente = Number(instalacion.idCliente);
    await manager.update(
      Productos,
      { id: Number(instalacion.idProducto), idCliente },
      { estatus },
    );
    if (instalacion.idDispositivo != null) {
      await manager.update(
        Dispositivos,
        { id: Number(instalacion.idDispositivo), idCliente },
        { estatus },
      );
    }
    if (instalacion.idSim != null) {
      await manager.update(
        Sims,
        { id: Number(instalacion.idSim), idCliente },
        { estatus },
      );
    }
  }

  private async validarDispositivoSinInstalacionActiva(
    idDispositivo: number,
    idCliente: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.idDispositivo = :idDispositivo', { idDispositivo })
      .andWhere('i.estatus = :estatus', { estatus: EstatusEnum.ACTIVO });
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    if (await qb.getOne()) {
      throw new BadRequestException(
        'El dispositivo ya tiene una instalación activa',
      );
    }
  }

  private async validarSimSinInstalacionActiva(
    idSim: number,
    idCliente: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.idSim = :idSim', { idSim })
      .andWhere('i.estatus = :estatus', { estatus: EstatusEnum.ACTIVO });
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    if (await qb.getOne()) {
      throw new BadRequestException('El SIM ya tiene una instalación activa');
    }
  }

  private async validarEstatusEnCatalogo(id: number): Promise<void> {
    const estatus = await this.estatusInstalacionRepo.findOne({
      where: { id },
    });
    if (!estatus) {
      throw new BadRequestException('EstatusInstalacion no existe en catálogo');
    }
  }

  /**
   * Asigna la instalación a usuarios activos:
   * - rol SA (1), sin filtro de cliente
   * - rol cliente (6) del mismo idCliente de la instalación
   * Evita duplicados si ya existe la relación usuario-instalación.
   */
  private async asignarInstalacionUsuariosPorDefecto(
    manager: EntityManager,
    idInstalacion: number,
    idCliente: number,
  ): Promise<void> {
    try {
      const usuarios = await manager.find(Usuarios, {
        where: [
          { idRol: EnumRoles.SA, estatus: EstatusEnum.ACTIVO },
          {
            idRol: EnumRoles.CLIENTE,
            idCliente,
            estatus: EstatusEnum.ACTIVO,
          },
        ],
        select: { id: true },
      });

      if (usuarios.length === 0) {
        return;
      }

      const idsUsuario = [
        ...new Set(usuarios.map((u) => Number(u.id)).filter((id) => Number.isFinite(id))),
      ];

      const existentes = await manager.find(UsuariosInstalaciones, {
        where: {
          idInstalacion,
          idUsuario: In(idsUsuario),
        },
        select: { idUsuario: true },
      });
      const yaAsignados = new Set(
        existentes.map((r) => Number(r.idUsuario)),
      );

      const pendientes = idsUsuario.filter((idUsuario) => !yaAsignados.has(idUsuario));
      if (pendientes.length === 0) {
        return;
      }

      await manager.save(
        UsuariosInstalaciones,
        pendientes.map((idUsuario) =>
          manager.create(UsuariosInstalaciones, {
            idUsuario,
            idInstalacion,
            estatus: EstatusEnum.ACTIVO,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No fue posible asignar la instalación a los usuarios correspondientes. La operación no se completó.',
      );
    }
  }

  /**
   * Migra todas las filas de UsuariosInstalaciones del id anterior al nuevo.
   * Si el usuario ya tiene relación con la instalación nueva, elimina la del id anterior.
   */
  private async migrarUsuariosInstalaciones(
    manager: EntityManager,
    idInstalacionAnterior: number,
    idInstalacionNueva: number,
  ): Promise<void> {
    try {
      const relaciones = await manager.find(UsuariosInstalaciones, {
        where: { idInstalacion: idInstalacionAnterior },
      });

      if (relaciones.length === 0) {
        return;
      }

      const idsUsuario = [
        ...new Set(relaciones.map((r) => Number(r.idUsuario))),
      ];
      const existentesNueva = await manager.find(UsuariosInstalaciones, {
        where: {
          idInstalacion: idInstalacionNueva,
          idUsuario: In(idsUsuario),
        },
        select: { idUsuario: true },
      });
      const yaEnNueva = new Set(
        existentesNueva.map((r) => Number(r.idUsuario)),
      );

      for (const rel of relaciones) {
        const idUsuario = Number(rel.idUsuario);
        if (yaEnNueva.has(idUsuario)) {
          await manager.delete(UsuariosInstalaciones, { id: rel.id });
        } else {
          await manager.update(
            UsuariosInstalaciones,
            { id: rel.id },
            { idInstalacion: idInstalacionNueva },
          );
          yaEnNueva.add(idUsuario);
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No fue posible actualizar las asignaciones de usuarios de la instalación. La operación no se completó.',
      );
    }
  }

  private resolverAccionCambio(
    actual: Instalaciones,
    dto: UpdateInstalacionesDto,
  ): EnumAccionHistoricoInstalacion {
    const cambiaProducto =
      dto.idProducto !== undefined &&
      Number(dto.idProducto) !== Number(actual.idProducto);
    const cambiaDispositivo =
      dto.idDispositivo !== undefined &&
      (dto.idDispositivo == null
        ? actual.idDispositivo != null
        : Number(dto.idDispositivo) !== Number(actual.idDispositivo));
    const cambiaSim =
      dto.idSim !== undefined &&
      (dto.idSim == null
        ? actual.idSim != null
        : Number(dto.idSim) !== Number(actual.idSim));

    if (cambiaProducto) return EnumAccionHistoricoInstalacion.CAMBIO_PRODUCTO;
    if (cambiaDispositivo)
      return EnumAccionHistoricoInstalacion.CAMBIO_DISPOSITIVO;
    if (cambiaSim) return EnumAccionHistoricoInstalacion.CAMBIO_SIM;
    return EnumAccionHistoricoInstalacion.CAMBIO_PRODUCTO;
  }

  async create(
    dto: CreateInstalacionesDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await this.validarProductoDisponibleParaAsignar(
        dto.idProducto,
        idCliente,
      );
      if (dto.idDispositivo != null) {
        await this.validarDispositivoDisponibleParaAsignar(
          dto.idDispositivo,
          idCliente,
        );
      }
      if (dto.idSim != null) {
        await this.validarSimDisponibleParaAsignar(dto.idSim, idCliente);
      }
      await this.validarEstatusEnCatalogo(EnumEstatusInstalacion.ACTIVA);

      const ahora = nowMexicoCityAsUtcDate();
      const idDispositivo = dto.idDispositivo ?? null;
      const idSim = dto.idSim ?? null;

      const saved = await qr.manager.save(
        qr.manager.create(Instalaciones, {
          idCliente,
          idProducto: dto.idProducto,
          idDispositivo,
          idSim,
          estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
          idHistoricoInstalacion: null,
          vigenteDesde: ahora,
          idUsuario: idUser,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      await qr.manager.update(
        Productos,
        { id: dto.idProducto, idCliente },
        { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
      );
      if (idDispositivo != null) {
        await qr.manager.update(
          Dispositivos,
          { id: idDispositivo, idCliente },
          { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
        );
      }
      if (idSim != null) {
        await qr.manager.update(
          Sims,
          { id: idSim, idCliente },
          { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
        );
      }

      await this.asignarInstalacionUsuariosPorDefecto(
        qr.manager,
        Number(saved.id),
        idCliente,
      );

      await qr.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se creó la instalación ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Instalación creada correctamente',
        data: {
          id: Number(saved.id),
          nombre: `Instalación ${saved.id}`,
        },
      };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al crear instalación (Producto ${dto.idProducto})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No fue posible crear la instalación. Verifique los datos e intente nuevamente.',
      );
    } finally {
      await qr.release();
    }
  }

  async findAllList(
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }
      const where: FindOptionsWhere<Instalaciones> = {
        estatus: EstatusEnum.ACTIVO,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => mapInstalacionPlana(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllListByTipoProducto(
    idClienteToken: number,
    rol: number,
    idUsuarioToken: number,
    idTipoProducto: number,
  ): Promise<ApiResponseCommon> {
    const tipoProducto = Number(idTipoProducto) as EnumTipoProducto;
    if (
      ![
        EnumTipoProducto.VEHICULO,
        EnumTipoProducto.ACTIVO,
        EnumTipoProducto.INMUEBLE,
        EnumTipoProducto.PERSONA,
      ].includes(tipoProducto)
    ) {
      throw new BadRequestException(
        'idTipoProducto debe ser 1 (vehículo), 2 (activo), 3 (inmueble) o 4 (persona)',
      );
    }

    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const qb = this.repository.createQueryBuilder('i');
      applyPaginadoBaseJoins(qb);
      applyPaginadoSelectBase(qb);
      applyPaginadoPorTipoProducto(qb, tipoProducto);

      qb.andWhere('p.idTipoProducto = :idTipoProducto', {
        idTipoProducto: tipoProducto,
      })
        .andWhere('i.estatus = :estatusInstalacion', {
          estatusInstalacion: EstatusEnum.ACTIVO,
        })
        .orderBy('i.id', 'ASC');

      if (Number(rol) === EnumRoles.USUARIO) {
        qb.innerJoin(
          UsuariosInstalaciones,
          'ui',
          'ui.idInstalacion = i.id AND ui.idUsuario = :idUsuario AND ui.estatus = :uiEstatus',
          {
            idUsuario: Number(idUsuarioToken),
            uiEstatus: EstatusEnum.ACTIVO,
          },
        );
      }

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const rows = await qb.getRawMany();

      return {
        data: rows.map((row) =>
          mapInstalacionPaginadaPlana(row, tipoProducto),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllPaginado(
    idClienteToken: number,
    rol: number,
    dto: FilterInstalacionesPaginadoDto,
  ): Promise<ApiResponseCommon> {
    const { page, limit, idTipoProducto } = dto;
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const qb = this.repository.createQueryBuilder('i');

      applyPaginadoBaseJoins(qb);
      applyPaginadoSelectBase(qb);

      if (idTipoProducto != null) {
        applyPaginadoPorTipoProducto(qb, idTipoProducto);
        qb.andWhere('p.idTipoProducto = :idTipoProducto', { idTipoProducto });
      } else {
        applyPaginadoTodosTiposProducto(qb);
      }

      qb.orderBy('i.id', 'ASC');

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const total = await qb
        .clone()
        .select('COUNT(DISTINCT i.id)', 'cnt')
        .orderBy()
        .getRawOne()
        .then((r) => Number(r?.cnt ?? 0));

      const rows = await qb
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany();

      return {
        data: rows.map((row) =>
          mapInstalacionPaginadaPlana(row, idTipoProducto),
        ),
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

  private extractInValues(op: ReturnType<typeof In>): number[] {
    const anyOp = op as unknown as { value?: unknown };
    const raw = anyOp.value;
    if (Array.isArray(raw)) {
      return raw.map(Number);
    }
    return [];
  }

  async findOne(id: number, idClienteToken: number, rol: number) {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const metaQb = this.repository
        .createQueryBuilder('i')
        .innerJoin(
          Productos,
          'p',
          'p.id = i.idProducto AND p.idCliente = i.idCliente',
        )
        .select([
          'i.id AS id',
          'p.idTipoProducto AS idTipoProducto',
        ])
        .where('i.id = :id', { id });

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          metaQb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          metaQb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const meta = await metaQb.getRawOne<{
        id: string | number;
        idTipoProducto: string | number;
      }>();
      if (!meta) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const idTipoProducto = Number(meta.idTipoProducto) as EnumTipoProducto;

      const qb = this.repository.createQueryBuilder('i');
      applyDetalleJoins(qb);
      applyDetalleSelectBase(qb);
      applyDetallePorTipoProducto(qb, idTipoProducto);
      qb.where('i.id = :id', { id });

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const row = await qb.getRawOne();
      if (!row) {
        throw new NotFoundException('Instalación no encontrada');
      }

      return {
        data: mapInstalacionDetallePlana(row, idTipoProducto),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al buscar la instalación',
      );
    }
  }

  /**
   * Cadena de histórico de lo más reciente a lo más antiguo.
   * Si la instalación aún existe, parte de su IdHistoricoInstalacion.
   * También incluye filas con IdInstalacionOriginal = id (bajas / eslabones).
   */
  async findHistorico(id: number, idClienteToken: number, rol: number) {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación o histórico no encontrado');
      }

      const whereInst: FindOptionsWhere<Instalaciones> = {
        id,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const vigente = await this.repository.findOne({
        where: whereInst,
        relations: [...RELACIONES_INSTALACION_HISTORICO],
      });

      const cadena: HistoricoInstalaciones[] = [];
      const visitados = new Set<number>();

      let cursorId: number | null =
        vigente?.idHistoricoInstalacion != null
          ? Number(vigente.idHistoricoInstalacion)
          : null;

      if (cursorId == null) {
        const ultimoPorOriginal = await this.historicoRepo.findOne({
          where: {
            idInstalacionOriginal: id,
            ...(tenant.idCliente !== undefined
              ? { idCliente: tenant.idCliente as number }
              : {}),
          },
          order: { id: 'DESC' },
        });
        cursorId = ultimoPorOriginal ? Number(ultimoPorOriginal.id) : null;
      }

      while (cursorId != null && !visitados.has(cursorId)) {
        visitados.add(cursorId);
        const hist = await this.historicoRepo.findOne({
          where: {
            id: cursorId,
            ...(tenant.idCliente !== undefined
              ? { idCliente: tenant.idCliente as number }
              : {}),
          },
          relations: [...RELACIONES_INSTALACION_HISTORICO],
        });
        if (!hist) break;
        cadena.push(hist);
        cursorId =
          hist.idHistoricoInstalacion != null
            ? Number(hist.idHistoricoInstalacion)
            : null;
      }

      if (!vigente && cadena.length === 0) {
        throw new NotFoundException('Instalación o histórico no encontrado');
      }

      return {
        data: {
          vigente: vigente ? mapInstalacionPlana(vigente) : null,
          historico: cadena.map((h) => mapHistoricoPlano(h)),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al consultar el histórico de la instalación',
      );
    }
  }

  async update(
    id: number,
    dto: UpdateInstalacionesDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación no encontrada');
      }
      const where: FindOptionsWhere<Instalaciones> = {
        id,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const actual = await qr.manager.findOne(Instalaciones, { where });
      if (!actual) {
        throw new NotFoundException('Instalación no encontrada');
      }
      if (Number(actual.estatus) !== EstatusEnum.ACTIVO) {
        throw new BadRequestException(
          'Solo se puede actualizar una instalación activa',
        );
      }

      if (
        !ESTATUS_INSTALACION_UPDATE_HISTORICO.includes(
          dto.estatusInstalacionAnterior as (typeof ESTATUS_INSTALACION_UPDATE_HISTORICO)[number],
        )
      ) {
        throw new BadRequestException(
          'estatusInstalacionAnterior debe ser 0, 1, 3, 4 o 5',
        );
      }
      await this.validarEstatusEnCatalogo(dto.estatusInstalacionAnterior);

      const idCliente = Number(actual.idCliente);
      const idProducto =
        dto.idProducto !== undefined ? dto.idProducto : Number(actual.idProducto);
      const idDispositivo =
        dto.idDispositivo !== undefined
          ? dto.idDispositivo
          : actual.idDispositivo != null
            ? Number(actual.idDispositivo)
            : null;
      const idSim =
        dto.idSim !== undefined
          ? dto.idSim
          : actual.idSim != null
            ? Number(actual.idSim)
            : null;

      const sinCambios =
        idProducto === Number(actual.idProducto) &&
        idDispositivo ===
          (actual.idDispositivo != null
            ? Number(actual.idDispositivo)
            : null) &&
        idSim === (actual.idSim != null ? Number(actual.idSim) : null);
      if (sinCambios) {
        throw new BadRequestException(
          'No hay cambios en producto, dispositivo o SIM',
        );
      }

      const idProductoAnterior = Number(actual.idProducto);
      const idDispositivoAnterior =
        actual.idDispositivo != null ? Number(actual.idDispositivo) : null;
      const idSimAnterior =
        actual.idSim != null ? Number(actual.idSim) : null;

      const cambiaProducto = idProducto !== idProductoAnterior;
      const cambiaDispositivo = idDispositivo !== idDispositivoAnterior;
      const cambiaSim = idSim !== idSimAnterior;

      let estatusProductoSaliente: EnumEstatusProductoDispositivo | null =
        null;
      let estatusDispositivoSaliente: EnumEstatusProductoDispositivo | null =
        null;
      let estatusSimSaliente: EnumEstatusProductoDispositivo | null = null;

      if (cambiaProducto) {
        estatusProductoSaliente = this.assertEstatusComponenteAnterior(
          dto.estatusProductoAnterior,
          'estatusProductoAnterior',
        );
        await this.validarProductoDisponibleParaAsignar(
          idProducto,
          idCliente,
        );
      } else {
        await this.validarProducto(idProducto, idCliente);
      }

      if (cambiaDispositivo) {
        if (idDispositivoAnterior != null) {
          estatusDispositivoSaliente = this.assertEstatusComponenteAnterior(
            dto.estatusDispositivoAnterior,
            'estatusDispositivoAnterior',
          );
        }
        if (idDispositivo != null) {
          await this.validarDispositivoDisponibleParaAsignar(
            idDispositivo,
            idCliente,
            id,
          );
        }
      } else if (idDispositivo != null) {
        await this.validarDispositivoPerteneceCliente(
          idDispositivo,
          idCliente,
        );
      }

      if (cambiaSim) {
        if (idSimAnterior != null) {
          estatusSimSaliente = this.assertEstatusComponenteAnterior(
            dto.estatusSimAnterior,
            'estatusSimAnterior',
          );
        }
        if (idSim != null) {
          await this.validarSimDisponibleParaAsignar(idSim, idCliente, id);
        }
      } else if (idSim != null) {
        await this.validarSimPerteneceCliente(idSim, idCliente);
      }

      const ahora = nowMexicoCityAsUtcDate();
      const accion = this.resolverAccionCambio(actual, dto);

      const hist = await qr.manager.save(
        qr.manager.create(HistoricoInstalaciones, {
          idCliente,
          idProducto: idProductoAnterior,
          idDispositivo: idDispositivoAnterior,
          idSim: idSimAnterior,
          estatusInstalacion: dto.estatusInstalacionAnterior,
          idInstalacionOriginal: Number(actual.id),
          vigenteDesde: actual.vigenteDesde,
          vigenteHasta: ahora,
          idHistoricoInstalacion:
            actual.idHistoricoInstalacion != null
              ? Number(actual.idHistoricoInstalacion)
              : null,
          idUsuario:
            actual.idUsuario != null ? Number(actual.idUsuario) : null,
          accion,
          comentario: dto.comentario ?? null,
          fhArchivado: ahora,
        }),
      );

      // Libera UQ_Inst_SimActivo / UQ_Inst_DispositivoActivo antes del INSERT
      // (columnas generadas = NULL cuando Estatus != 1).
      await qr.manager.update(
        Instalaciones,
        { id: actual.id, idCliente },
        { estatus: EstatusEnum.INACTIVO },
      );

      const nueva = await qr.manager.save(
        qr.manager.create(Instalaciones, {
          idCliente,
          idProducto,
          idDispositivo,
          idSim,
          estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
          idHistoricoInstalacion: Number(hist.id),
          vigenteDesde: ahora,
          idUsuario: idUser,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      await this.migrarUsuariosInstalaciones(
        qr.manager,
        Number(actual.id),
        Number(nueva.id),
      );

      await qr.manager.delete(Instalaciones, { id: actual.id, idCliente });

      if (cambiaProducto && estatusProductoSaliente != null) {
        await qr.manager.update(
          Productos,
          { id: idProductoAnterior, idCliente },
          { estatus: estatusProductoSaliente },
        );
        await qr.manager.update(
          Productos,
          { id: idProducto, idCliente },
          { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
        );
      }

      if (cambiaDispositivo) {
        if (
          idDispositivoAnterior != null &&
          estatusDispositivoSaliente != null
        ) {
          await qr.manager.update(
            Dispositivos,
            { id: idDispositivoAnterior, idCliente },
            { estatus: estatusDispositivoSaliente },
          );
        }
        if (idDispositivo != null) {
          await qr.manager.update(
            Dispositivos,
            { id: idDispositivo, idCliente },
            { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
          );
        }
      }

      if (cambiaSim) {
        if (idSimAnterior != null && estatusSimSaliente != null) {
          await qr.manager.update(
            Sims,
            { id: idSimAnterior, idCliente },
            { estatus: estatusSimSaliente },
          );
        }
        if (idSim != null) {
          await qr.manager.update(
            Sims,
            { id: idSim, idCliente },
            { estatus: EnumEstatusProductoDispositivo.ASIGNADO },
          );
        }
      }

      await qr.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizó la instalación ID: ${id} → nueva ID: ${nueva.id} (${accion})`,
        'UPDATE',
        { idAnterior: id, idNuevo: Number(nueva.id), dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Instalación actualizada correctamente',
        data: {
          id: Number(nueva.id),
          nombre: `Instalación ${nueva.id}`,
        },
      };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar instalación ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      await qr.release();
    }
  }

  /**
   * PATCH estatus (solo 0, 1, 5):
   * - 0 / 5: EstatusInstalacion = valor, Estatus fila = 0 (SimActivo/DispositivoActivo NULL),
   *   componentes → 1 (disponible). Sin histórico ni DELETE.
   * - 1: exige componentes en 1; luego EstatusInstalacion=1, Estatus fila=1,
   *   componentes → 2 (asignado).
   */
  async baja(
    id: number,
    dto: BajaInstalacionDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    if (
      !ESTATUS_INSTALACION_PATCH.includes(
        dto.estatusInstalacion as (typeof ESTATUS_INSTALACION_PATCH)[number],
      )
    ) {
      throw new BadRequestException(
        'El estatus indicado no es válido. Solo se permiten 0 (inactivo), 1 (activa) o 5 (inservible).',
      );
    }
    await this.validarEstatusEnCatalogo(dto.estatusInstalacion);

    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('No se encontró la instalación solicitada.');
    }
    const where: FindOptionsWhere<Instalaciones> = {
      id,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const actual = await qr.manager.findOne(Instalaciones, { where });
      if (!actual) {
        throw new NotFoundException('No se encontró la instalación solicitada.');
      }

      const idCliente = Number(actual.idCliente);
      const componentes = {
        idCliente,
        idProducto: Number(actual.idProducto),
        idDispositivo:
          actual.idDispositivo != null ? Number(actual.idDispositivo) : null,
        idSim: actual.idSim != null ? Number(actual.idSim) : null,
      };

      if (dto.estatusInstalacion === EnumEstatusInstalacion.ACTIVA) {
        await this.assertComponentesDisponiblesParaActivar(
          qr.manager,
          componentes,
        );

        await qr.manager.update(
          Instalaciones,
          { id: actual.id, idCliente },
          {
            estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
            estatus: EstatusEnum.ACTIVO,
            idUsuario: idUser,
          },
        );
        await this.sincronizarEstatusComponentes(
          qr.manager,
          componentes,
          EnumEstatusProductoDispositivo.ASIGNADO,
        );

        await qr.commitTransaction();

        await this.bitacoraLogger.logToBitacora(
          'Instalaciones',
          `Se activó la instalación ID: ${id}`,
          'UPDATE',
          { id, dto, idCliente },
          idUser,
          EnumModulos.INSTALACIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        return {
          status: 'success',
          message: 'La instalación se activó correctamente.',
          estatus: { estatus: EnumEstatusInstalacion.ACTIVA },
          data: { id, nombre: `Instalación ${id}` },
        };
      }

      // 0 o 5: desactivar fila + liberar componentes a disponible
      await qr.manager.update(
        Instalaciones,
        { id: actual.id, idCliente },
        {
          estatusInstalacion: dto.estatusInstalacion,
          estatus: EstatusEnum.INACTIVO,
          idUsuario: idUser,
        },
      );
      await this.sincronizarEstatusComponentes(
        qr.manager,
        componentes,
        EnumEstatusProductoDispositivo.ACTIVO,
      );

      await qr.commitTransaction();

      const etiqueta =
        dto.estatusInstalacion === EnumEstatusInstalacion.INACTIVO
          ? 'inactivo'
          : 'inservible';

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se cambió la instalación ID: ${id} a estatus ${etiqueta} (${dto.estatusInstalacion})`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message:
          dto.estatusInstalacion === EnumEstatusInstalacion.INACTIVO
            ? 'La instalación se marcó como inactiva correctamente.'
            : 'La instalación se marcó como inservible correctamente.',
        estatus: { estatus: dto.estatusInstalacion },
        data: { id, nombre: `Instalación ${id}` },
      };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar estatus de instalación ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No se pudo actualizar el estatus de la instalación. Intente de nuevo o contacte a soporte.',
      );
    } finally {
      await qr.release();
    }
  }

  private async assertComponentesDisponiblesParaActivar(
    manager: EntityManager,
    instalacion: {
      idCliente: number;
      idProducto: number;
      idDispositivo: number | null;
      idSim: number | null;
    },
  ): Promise<void> {
    const producto = await manager.findOne(Productos, {
      where: {
        id: instalacion.idProducto,
        idCliente: instalacion.idCliente,
      },
    });
    if (!producto) {
      throw new BadRequestException(
        'No se puede activar la instalación: el producto vinculado no existe o no pertenece al cliente.',
      );
    }
    if (Number(producto.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'No se puede activar la instalación: el producto no está disponible (debe estar en estatus activo).',
      );
    }

    if (instalacion.idDispositivo != null) {
      const dispositivo = await manager.findOne(Dispositivos, {
        where: {
          id: instalacion.idDispositivo,
          idCliente: instalacion.idCliente,
        },
      });
      if (!dispositivo) {
        throw new BadRequestException(
          'No se puede activar la instalación: el dispositivo vinculado no existe o no pertenece al cliente.',
        );
      }
      if (
        Number(dispositivo.estatus) !== EnumEstatusProductoDispositivo.ACTIVO
      ) {
        throw new BadRequestException(
          'No se puede activar la instalación: el dispositivo no está disponible (debe estar en estatus activo).',
        );
      }
    }

    if (instalacion.idSim != null) {
      const sim = await manager.findOne(Sims, {
        where: {
          id: instalacion.idSim,
          idCliente: instalacion.idCliente,
        },
      });
      if (!sim) {
        throw new BadRequestException(
          'No se puede activar la instalación: el SIM vinculado no existe o no pertenece al cliente.',
        );
      }
      if (Number(sim.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
        throw new BadRequestException(
          'No se puede activar la instalación: el SIM no está disponible (debe estar en estatus activo).',
        );
      }
    }
  }
}

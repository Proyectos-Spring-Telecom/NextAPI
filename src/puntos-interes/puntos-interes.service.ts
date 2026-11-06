import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { EventosPuntoInteres } from 'src/entities/EventosPuntoInteres';
import { Productos } from 'src/entities/Productos';
import { ProductosPuntoInteres } from 'src/entities/ProductosPuntoInteres';
import { vehiculosLigados } from 'src/productos/vehiculos-ligados.util';
import { parseFechaHistorico } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import {
  EnumModulos,
  EnumRoles,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { CreatePuntoInteresDto } from './dto/create-punto-interes.dto';
import { UpdatePuntoInteresDto } from './dto/update-punto-interes.dto';
import {
  mapPuntoInteresPlano,
  RELACIONES_PUNTO_INTERES,
} from './map-puntos-interes.util';

@Injectable()
export class PuntosInteresService {
  constructor(
    @InjectRepository(PuntosInteres)
    private readonly repository: Repository<PuntosInteres>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

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
   * Cliente del punto nuevo. Monitoreo y administración (alcance global) deben
   * asignarlo a un cliente; un acceso del cliente lo deja en su cliente (o en
   * uno de sus hijos, si lo indica).
   */
  private async resolveIdClienteCreate(
    rol: number,
    idClienteToken: number,
    idClienteDto?: number,
  ): Promise<number> {
    const scope = await this.tenantFilter.idsClientePermitidos(rol, idClienteToken);
    if (idClienteDto == null) {
      if (scope === 'all') {
        throw new BadRequestException('idCliente es obligatorio: el punto de interés se asigna a un cliente');
      }
      return Number(idClienteToken);
    }
    await this.assertClienteExiste(idClienteDto);
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteDto)) {
      throw new ForbiddenException('No puedes crear puntos de interés para ese cliente');
    }
    return Number(idClienteDto);
  }

  private async resolveIdClienteUpdate(
    rol: number,
    idClienteToken: number,
    idClienteActual: number,
    idClienteDto?: number,
  ): Promise<number> {
    if (idClienteDto === undefined || Number(idClienteDto) === Number(idClienteActual)) {
      return Number(idClienteActual);
    }
    await this.assertClienteExiste(idClienteDto);
    await this.assertClienteEnAlcance(idClienteDto, idClienteToken, rol);
    return Number(idClienteDto);
  }

  /** Cada vehículo es del cliente del punto o de uno de sus hijos (`spGetClientes`). */
  private async assertVehiculosDelCliente(idCliente: number, idsProducto: number[]): Promise<void> {
    if (!idsProducto.length) return;
    const familia = await this.tenantFilter.getClienteHijosIds(idCliente);
    const encontrados = await this.repository.manager.count(Productos, {
      where: { id: In(idsProducto), idCliente: In(familia) },
    });
    if (encontrados !== idsProducto.length) {
      throw new BadRequestException(
        'Uno o más vehículos no existen o no son del cliente del punto ni de sus clientes hijos',
      );
    }
  }

  /** Lista definitiva de vehículos del punto: reactivar / crear / desactivar. */
  private async sincronizarVehiculos(
    repo: Repository<ProductosPuntoInteres>,
    idPuntoInteres: number,
    idsProducto: number[],
  ): Promise<void> {
    const nuevos = new Set(idsProducto.map(Number));
    const existentes = await repo.find({ where: { idPuntoInteres } });
    const porProducto = new Map(existentes.map((l) => [Number(l.idProducto), l]));
    for (const idProducto of nuevos) {
      const liga = porProducto.get(idProducto);
      if (!liga) {
        await repo.save(repo.create({ idPuntoInteres, idProducto, estatus: EstatusEnum.ACTIVO }));
      } else if (Number(liga.estatus) !== EstatusEnum.ACTIVO) {
        await repo.update(liga.id, { estatus: EstatusEnum.ACTIVO });
      }
    }
    for (const liga of existentes) {
      if (!nuevos.has(Number(liga.idProducto)) && Number(liga.estatus) === EstatusEnum.ACTIVO) {
        await repo.update(liga.id, { estatus: EstatusEnum.INACTIVO });
      }
    }
  }

  private vehiculosActivos(p: PuntosInteres): number[] {
    return (p.productosPuntoInteres ?? [])
      .filter((l) => Number(l.estatus) === EstatusEnum.ACTIVO)
      .map((l) => Number(l.idProducto));
  }

  private async mapear(items: PuntosInteres[]) {
    const vehiculos = await vehiculosLigados(this.repository.manager, items.flatMap((p) => this.vehiculosActivos(p)));
    return items.map((p) => mapPuntoInteresPlano(p, this.vehiculosActivos(p).map((id) => vehiculos.get(id)!)));
  }

  private async findVisibleOrFail(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<PuntosInteres> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('Punto de interés no encontrado');
    }

    const where: FindOptionsWhere<PuntosInteres> = {
      id,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    const entity = await this.repository.findOne({
      where,
      relations: [...RELACIONES_PUNTO_INTERES],
    });
    if (!entity) {
      throw new NotFoundException('Punto de interés no encontrado');
    }
    return entity;
  }

  async create(
    dto: CreatePuntoInteresDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const idCliente = await this.resolveIdClienteCreate(
        rol,
        idClienteToken,
        dto.idCliente,
      );

      const idsProducto = [...new Set((dto.idsProducto ?? []).map(Number))];
      await this.assertVehiculosDelCliente(idCliente, idsProducto);
      const entity = this.repository.create({
        idCliente,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        lng: dto.lng,
        lat: dto.lat,
        radioMetros:
          dto.radioMetros != null ? Number(dto.radioMetros) : 25,
        icono: dto.icono?.trim() || null,
        estatus: EstatusEnum.ACTIVO,
      });

      const saved = await this.repository.manager.transaction(async (m) => {
        const punto = await m.getRepository(PuntosInteres).save(entity);
        await this.sincronizarVehiculos(m.getRepository(ProductosPuntoInteres), Number(punto.id), idsProducto);
        return punto;
      });

      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        `Se creó el punto de interés ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PUNTOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Punto de interés creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        'Error al crear punto de interés',
        'CREATE',
        { dto },
        idUser,
        EnumModulos.PUNTOS,
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
    idClienteFiltro?: number,
    idProductoFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      let idClienteWhere = tenant.idCliente;
      if (idClienteFiltro != null) {
        // El cliente y sus hijos (spGetClientes), dentro del alcance del rol.
        const familia = await this.tenantFilter.clienteConHijosEnAlcance(rol, idClienteToken, idClienteFiltro);
        if (familia == null) return { data: [] };
        idClienteWhere = familia;
      }

      const where: FindOptionsWhere<PuntosInteres> = {
        estatus: EstatusEnum.ACTIVO,
        ...(idClienteWhere !== undefined
          ? { idCliente: idClienteWhere }
          : {}),
      };

      if (idProductoFiltro != null) {
        // Los que usa ese vehículo, aunque sean de un cliente padre (solo
        // lectura para quien no ve a ese cliente). El vehículo debe estar en el alcance.
        const vehiculo = await this.repository.manager.findOne(Productos, {
          where: { id: idProductoFiltro, ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}) },
          select: { id: true },
        });
        if (!vehiculo) return { data: [] };
        const ligas = await this.repository.manager.find(ProductosPuntoInteres, {
          where: { idProducto: idProductoFiltro, estatus: EstatusEnum.ACTIVO },
          select: { idPuntoInteres: true },
        });
        if (!ligas.length) return { data: [] };
        delete where.idCliente;
        where.id = In(ligas.map((l) => Number(l.idPuntoInteres)));
      }

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_PUNTO_INTERES],
        order: { id: 'ASC' },
      });

      return { data: await this.mapear(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findByIdCliente(
    idCliente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      await this.assertClienteExiste(idCliente);
      await this.assertClienteEnAlcance(idCliente, idClienteToken, rol);

      // El cliente y sus hijos (spGetClientes), dentro del alcance del rol.
      const familia = await this.tenantFilter.clienteConHijosEnAlcance(rol, idClienteToken, idCliente);
      if (familia == null) return { data: [] };
      const data = await this.repository.find({
        where: {
          idCliente: familia,
          estatus: EstatusEnum.ACTIVO,
        },
        relations: [...RELACIONES_PUNTO_INTERES],
        order: { id: 'ASC' },
      });

      return { data: await this.mapear(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idClienteToken: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
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

      const where: FindOptionsWhere<PuntosInteres> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };

      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_PUNTO_INTERES],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });

      return {
        data: await this.mapear(data),
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
   * Llegadas y salidas registradas en vivo (`EventosPuntoInteres`), de una
   * instalación o de un punto visibles para el usuario, en un periodo.
   */
  async eventos(
    filtro: { idInstalacion?: number; idPuntoInteres?: number; fechaInicio: string; fechaFinal: string },
    user: { userId: number; idCliente: number; rol: number },
  ): Promise<ApiResponseCommon> {
    if (filtro.idInstalacion == null && filtro.idPuntoInteres == null) {
      throw new BadRequestException('Indica idInstalacion o idPuntoInteres');
    }
    let desde: string;
    let hasta: string;
    try {
      desde = parseFechaHistorico(filtro.fechaInicio);
      hasta = parseFechaHistorico(filtro.fechaFinal);
    } catch {
      throw new BadRequestException('fechaInicio / fechaFinal tienen un formato inválido');
    }
    if (filtro.idInstalacion != null) {
      await this.tenantFilter.assertInstalacionVisible(user, filtro.idInstalacion);
    }
    if (filtro.idPuntoInteres != null) {
      await this.findVisibleOrFail(filtro.idPuntoInteres, user.idCliente, user.rol);
    }
    const qb = this.repository.manager
      .createQueryBuilder(EventosPuntoInteres, 'e')
      .innerJoin(PuntosInteres, 'p', 'p.id = e.idPuntoInteres')
      .select([
        'e.id AS id',
        'e.tipo AS tipo',
        'e.idPuntoInteres AS idPuntoInteres',
        'p.nombre AS nombrePuntoInteres',
        'e.idProducto AS idProducto',
        'e.idInstalacion AS idInstalacion',
        'e.idPosicion AS idPosicion',
        "DATE_FORMAT(e.fechaHora, '%Y-%m-%d %H:%i:%s') AS fechaHora",
      ])
      .where('e.fechaHora BETWEEN :desde AND :hasta', { desde, hasta })
      .orderBy('e.fechaHora', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .limit(5000);
    if (filtro.idInstalacion != null) qb.andWhere('e.idInstalacion = :i', { i: filtro.idInstalacion });
    if (filtro.idPuntoInteres != null) qb.andWhere('e.idPuntoInteres = :p', { p: filtro.idPuntoInteres });
    // Los 7/9 solo ven lo de sus instalaciones asignadas.
    const asignadas = await this.tenantFilter.idsInstalacionAsignadas(user);
    if (asignadas !== 'all') {
      if (!asignadas.length) return { data: [] };
      qb.andWhere('e.idInstalacion IN (:...asignadas)', { asignadas });
    }
    const filas = await qb.getRawMany<Record<string, unknown>>();
    return {
      data: filas.map((f) => ({
        id: Number(f.id),
        tipo: f.tipo,
        idPuntoInteres: Number(f.idPuntoInteres),
        nombrePuntoInteres: f.nombrePuntoInteres,
        idProducto: Number(f.idProducto),
        idInstalacion: Number(f.idInstalacion),
        idPosicion: Number(f.idPosicion),
        fechaHora: f.fechaHora,
      })),
    };
  }

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: ReturnType<typeof mapPuntoInteresPlano> }> {
    const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
    return { data: (await this.mapear([entity]))[0] };
  }

  async update(
    id: number,
    dto: UpdatePuntoInteresDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);

      const idCliente = await this.resolveIdClienteUpdate(
        rol,
        idClienteToken,
        Number(entity.idCliente),
        dto.idCliente,
      );

      if (dto.nombre !== undefined) {
        entity.nombre = dto.nombre.trim();
      }
      if (dto.descripcion !== undefined) {
        entity.descripcion = dto.descripcion?.trim() || null;
      }
      if (dto.lng !== undefined) {
        entity.lng = dto.lng;
      }
      if (dto.lat !== undefined) {
        entity.lat = dto.lat;
      }
      if (dto.radioMetros !== undefined) {
        entity.radioMetros = Number(dto.radioMetros);
      }
      if (dto.icono !== undefined) {
        entity.icono = dto.icono?.trim() || null;
      }
      // Sin lista nueva se quedan los vehículos; al cambiar de cliente deben
      // seguir siendo del cliente nuevo o de sus hijos.
      const enviados = Array.isArray(dto.idsProducto) ? [...new Set(dto.idsProducto.map(Number))] : undefined;
      if (enviados !== undefined || Number(entity.idCliente) !== idCliente) {
        await this.assertVehiculosDelCliente(idCliente, enviados ?? this.vehiculosActivos(entity));
      }
      entity.idCliente = idCliente;

      const { productosPuntoInteres: _ligas, ...datos } = entity;
      const saved = await this.repository.manager.transaction(async (m) => {
        const punto = await m.getRepository(PuntosInteres).save(datos as PuntosInteres);
        if (enviados !== undefined) {
          await this.sincronizarVehiculos(m.getRepository(ProductosPuntoInteres), Number(punto.id), enviados);
        }
        return punto;
      });

      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        `Se actualizó el punto de interés ID: ${saved.id}`,
        'UPDATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PUNTOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Punto de interés actualizado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        `Error al actualizar punto de interés ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.PUNTOS,
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
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      entity.estatus = estatus;
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        `Se cambió estatus del punto de interés ID: ${saved.id} → ${estatus}`,
        'UPDATE',
        { estatusAnterior, estatus },
        idUser,
        EnumModulos.PUNTOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PuntosInteres',
        `Error al cambiar estatus del punto de interés ID: ${id}`,
        'UPDATE',
        {},
        idUser,
        EnumModulos.PUNTOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}

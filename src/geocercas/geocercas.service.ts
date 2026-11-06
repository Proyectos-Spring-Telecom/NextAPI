import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Geocercas } from 'src/entities/Geocercas';
import { ProductosGeocerca } from 'src/entities/ProductosGeocerca';
import { vehiculosLigados } from 'src/productos/vehiculos-ligados.util';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';
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
import { CreateGeocercaDto } from './dto/create-geocerca.dto';
import { UpdateGeocercaDto } from './dto/update-geocerca.dto';
import {
  mapGeocercaPlano,
  RELACIONES_GEOCERCA,
} from './map-geocercas.util';


@Injectable()
export class GeocercasService {
  constructor(
    @InjectRepository(Geocercas)
    private readonly repository: Repository<Geocercas>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    private readonly dataSource: DataSource,
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

  /**
   * Vehículos que pide el cuerpo: `idsProducto` (lista definitiva) o, por
   * compatibilidad, `idProducto` / `idInstalacion` (obsoletos, uno solo).
   * `undefined` = no se envió nada (en la edición, no cambian).
   */
  private async vehiculosEnviados(dto: {
    idsProducto?: number[];
    idProducto?: number | null;
    idInstalacion?: number | null;
  }): Promise<number[] | undefined> {
    if (Array.isArray(dto.idsProducto)) {
      return [...new Set(dto.idsProducto.map(Number).filter((n) => n > 0))];
    }
    if (dto.idProducto !== undefined) {
      return dto.idProducto === null ? [] : [Number(dto.idProducto)];
    }
    if (dto.idInstalacion !== undefined) {
      if (dto.idInstalacion === null) return [];
      const instalacion = await this.instalacionesRepo.findOne({
        where: { id: dto.idInstalacion },
        select: { id: true, idProducto: true },
      });
      if (!instalacion) {
        throw new BadRequestException('IdInstalacion no existe');
      }
      return [Number(instalacion.idProducto)];
    }
    return undefined;
  }

  /** Cada vehículo es del cliente de la geocerca o de uno de sus hijos (`spGetClientes`). */
  private async assertVehiculosDelCliente(idCliente: number, idsProducto: number[]): Promise<void> {
    if (!idsProducto.length) return;
    const familia = await this.tenantFilter.getClienteHijosIds(idCliente);
    const encontrados = await this.instalacionesRepo.manager.count(Productos, {
      where: { id: In(idsProducto), idCliente: In(familia) },
    });
    if (encontrados !== idsProducto.length) {
      throw new BadRequestException(
        'Uno o más vehículos no existen o no son del cliente de la geocerca ni de sus clientes hijos',
      );
    }
  }

  /** Lista definitiva de vehículos de la geocerca: reactivar / crear / desactivar. */
  private async sincronizarVehiculos(
    repo: Repository<ProductosGeocerca>,
    idGeocerca: number,
    idsProducto: number[],
  ): Promise<void> {
    const nuevos = new Set(idsProducto.map(Number));
    const existentes = await repo.find({ where: { idGeocerca } });
    const porProducto = new Map(existentes.map((l) => [Number(l.idProducto), l]));
    for (const idProducto of nuevos) {
      const liga = porProducto.get(idProducto);
      if (!liga) {
        await repo.save(repo.create({ idGeocerca, idProducto, estatus: EstatusEnum.ACTIVO }));
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

  private vehiculosActivos(g: Geocercas): number[] {
    return (g.productosGeocerca ?? [])
      .filter((l) => Number(l.estatus) === EstatusEnum.ACTIVO)
      .map((l) => Number(l.idProducto));
  }

  private async mapear(items: Geocercas[]) {
    const vehiculos = await vehiculosLigados(this.dataSource.manager, items.flatMap((g) => this.vehiculosActivos(g)));
    return items.map((g) => mapGeocercaPlano(g, this.vehiculosActivos(g).map((id) => vehiculos.get(id)!)));
  }

  /**
   * Cliente de la geocerca nueva. Monitoreo y administración (alcance global)
   * deben asignarla a un cliente; un acceso del cliente la deja en su cliente
   * (o en uno de sus hijos, si lo indica).
   */
  private async resolveIdClienteCreate(
    rol: number,
    idClienteToken: number,
    idClienteDto?: number,
  ): Promise<number> {
    const scope = await this.tenantFilter.idsClientePermitidos(rol, idClienteToken);
    if (idClienteDto == null) {
      if (scope === 'all') {
        throw new BadRequestException('idCliente es obligatorio: la geocerca se asigna a un cliente');
      }
      return Number(idClienteToken);
    }
    await this.assertClienteExiste(idClienteDto);
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteDto)) {
      throw new ForbiddenException('No puedes crear geocercas para ese cliente');
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
    const scope = await this.tenantFilter.idsClientePermitidos(rol, idClienteToken);
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteDto)) {
      throw new ForbiddenException('No puedes reasignar la geocerca a ese cliente');
    }
    return Number(idClienteDto);
  }

  private async findVisibleOrFail(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<Geocercas> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('Geocerca no encontrada');
    }

    const where: FindOptionsWhere<Geocercas> = {
      id,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    const entity = await this.repository.findOne({
      where,
      relations: [...RELACIONES_GEOCERCA],
    });
    if (!entity) {
      throw new NotFoundException('Geocerca no encontrada');
    }
    return entity;
  }

  async create(
    dto: CreateGeocercaDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const idCliente = await this.resolveIdClienteCreate(
        rol,
        idClienteToken,
        dto.idCliente,
      );
      const idsProducto = (await this.vehiculosEnviados(dto)) ?? [];
      await this.assertVehiculosDelCliente(idCliente, idsProducto);

      const geocercaRepo = queryRunner.manager.getRepository(Geocercas);
      const ligasRepo = queryRunner.manager.getRepository(ProductosGeocerca);

      const entity = geocercaRepo.create({
        idCliente,
        idProducto: null,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        geocerca: dto.geocerca,
        estatus: EstatusEnum.ACTIVO,
      });

      const saved = await geocercaRepo.save(entity);
      await this.sincronizarVehiculos(ligasRepo, Number(saved.id), idsProducto);

      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Se creó la geocerca ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente, idsProducto },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Geocerca creada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        'Error al crear geocerca',
        'CREATE',
        { dto },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      await queryRunner.release();
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

      const where: FindOptionsWhere<Geocercas> = {
        estatus: EstatusEnum.ACTIVO,
        ...(idClienteWhere !== undefined
          ? { idCliente: idClienteWhere }
          : {}),
      };
      if (idProductoFiltro != null) {
        // Las que usa ese vehículo, aunque sean de un cliente padre (solo lectura
        // para quien no ve a ese cliente). El vehículo debe estar en el alcance.
        const vehiculo = await this.instalacionesRepo.manager.findOne(Productos, {
          where: { id: idProductoFiltro, ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}) },
          select: { id: true },
        });
        if (!vehiculo) return { data: [] };
        const ligas = await this.dataSource.getRepository(ProductosGeocerca).find({
          where: { idProducto: idProductoFiltro, estatus: EstatusEnum.ACTIVO },
          select: { idGeocerca: true },
        });
        if (!ligas.length) return { data: [] };
        delete where.idCliente;
        where.id = In(ligas.map((l) => Number(l.idGeocerca)));
      }

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_GEOCERCA],
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

      const where: FindOptionsWhere<Geocercas> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };

      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_GEOCERCA],
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

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: ReturnType<typeof mapGeocercaPlano> }> {
    const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
    return { data: (await this.mapear([entity]))[0] };
  }

  async update(
    id: number,
    dto: UpdateGeocercaDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
      const idClienteAnterior = Number(entity.idCliente);

      const idCliente = await this.resolveIdClienteUpdate(
        rol,
        idClienteToken,
        idClienteAnterior,
        dto.idCliente,
      );

      // Sin lista nueva se quedan los vehículos que tiene; al cambiar de cliente
      // deben seguir siendo del cliente nuevo o de sus hijos.
      const enviados = await this.vehiculosEnviados(dto);
      const idsProducto = enviados ?? this.vehiculosActivos(entity);
      if (enviados !== undefined || idClienteAnterior !== idCliente) {
        await this.assertVehiculosDelCliente(idCliente, idsProducto);
      }

      const geocercaRepo = queryRunner.manager.getRepository(Geocercas);
      const ligasRepo = queryRunner.manager.getRepository(ProductosGeocerca);

      if (dto.nombre !== undefined) {
        entity.nombre = dto.nombre.trim();
      }
      if (dto.descripcion !== undefined) {
        entity.descripcion = dto.descripcion?.trim() || null;
      }
      if (dto.geocerca !== undefined) {
        entity.geocerca = dto.geocerca;
      }
      entity.idCliente = idCliente;
      // La columna vieja ya no se usa (ProductosGeocerca); se limpia para no
      // chocar con su llave al cambiar de cliente.
      entity.idProducto = null;

      const { productosGeocerca: _ligas, ...datos } = entity;
      const saved = await geocercaRepo.save(datos as Geocercas);

      if (enviados !== undefined) {
        await this.sincronizarVehiculos(ligasRepo, Number(saved.id), idsProducto);
      }

      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Se actualizó la geocerca ID: ${saved.id}`,
        'UPDATE',
        { dto, idCliente },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Geocerca actualizada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Error al actualizar geocerca ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      await queryRunner.release();
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
        'Geocercas',
        `Se cambió estatus de la geocerca ID: ${saved.id} → ${estatus}`,
        'UPDATE',
        { estatusAnterior, estatus },
        idUser,
        EnumModulos.GEOCERCAS,
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
        'Geocercas',
        `Error al cambiar estatus de la geocerca ID: ${id}`,
        'UPDATE',
        {},
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async remove(
    id: number,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
      const nombre = entity.nombre;
      const idEliminado = Number(entity.id);

      // ProductosGeocerca (y la vieja UsuariosGeocerca) se eliminan en cascada por FK
      await this.repository.delete({ id: idEliminado });

      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Se eliminó permanentemente la geocerca ID: ${idEliminado}`,
        'DELETE',
        { id: idEliminado, nombre },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Geocerca eliminada permanentemente',
        data: { id: idEliminado, nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Error al eliminar geocerca ID: ${id}`,
        'DELETE',
        { id },
        idUser,
        EnumModulos.GEOCERCAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}

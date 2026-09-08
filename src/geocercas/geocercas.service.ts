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
import { UsuariosGeocerca } from 'src/entities/UsuariosGeocerca';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
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

  private esRolClienteFijo(rol: number): boolean {
    const r = Number(rol);
    return r === EnumRoles.CLIENTE || r === EnumRoles.USUARIO;
  }

  private async assertClienteExiste(idCliente: number): Promise<void> {
    const cliente = await this.clientesRepo.findOne({
      where: { id: idCliente },
    });
    if (!cliente) {
      throw new BadRequestException('IdCliente no existe');
    }
  }

  private async assertInstalacionDelCliente(
    idCliente: number,
    idInstalacion: number | null | undefined,
  ): Promise<number | null> {
    if (idInstalacion == null) {
      return null;
    }
    const instalacion = await this.instalacionesRepo.findOne({
      where: { id: idInstalacion, idCliente },
    });
    if (!instalacion) {
      throw new BadRequestException(
        'IdInstalacion no existe o no pertenece al cliente',
      );
    }
    return Number(idInstalacion);
  }

  private async assertUsuariosDelCliente(
    idCliente: number,
    usuariosIds: number[],
  ): Promise<number[]> {
    const ids = [...new Set(usuariosIds.map(Number).filter((n) => n > 0))];
    if (ids.length === 0) {
      return [];
    }

    const usuarios = await this.usuariosRepo.find({
      where: { id: In(ids), idCliente },
      select: ['id'],
    });

    if (usuarios.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más usuarios no existen o no pertenecen al cliente de la geocerca',
      );
    }
    return ids;
  }

  /** Resuelve usuarios a vincular en create según el rol. */
  private async resolveUsuariosIdsCreate(
    rol: number,
    idUserToken: number,
    idCliente: number,
    usuariosIdsDto?: number[],
  ): Promise<number[]> {
    const enviados = Array.isArray(usuariosIdsDto)
      ? [...new Set(usuariosIdsDto.map(Number).filter((n) => n > 0))]
      : [];

    if (this.esRolClienteFijo(rol)) {
      const ids = enviados.length > 0 ? enviados : [Number(idUserToken)];
      return this.assertUsuariosDelCliente(idCliente, ids);
    }

    if (enviados.length === 0) {
      throw new BadRequestException(
        'usuariosIds es obligatorio y debe incluir al menos un usuario',
      );
    }

    return this.assertUsuariosDelCliente(idCliente, enviados);
  }

  /**
   * Misma lógica que `sincronizarRelacionesEstatus` de usuarios (permisos):
   * lista definitiva → reactivar / crear / desactivar.
   */
  private async sincronizarUsuariosGeocerca(
    repo: Repository<UsuariosGeocerca>,
    idGeocerca: number,
    usuariosIds: number[],
  ): Promise<void> {
    const nuevaLista = [...new Set(usuariosIds.map(Number))];
    const nuevaSet = new Set(nuevaLista);

    const relacionesExistentes = await repo.find({
      where: { idGeocerca },
    });

    const existentesMap = new Map(
      relacionesExistentes.map((relacion) => [
        Number(relacion.idUsuario),
        relacion,
      ]),
    );

    const todosIds = new Set([...nuevaLista, ...existentesMap.keys()]);

    for (const idUsuario of todosIds) {
      const debeEstarActivo = nuevaSet.has(idUsuario);
      const relacionExistente = existentesMap.get(idUsuario);

      if (debeEstarActivo && relacionExistente) {
        if (Number(relacionExistente.estatus) === 0) {
          await repo.update(relacionExistente.id, { estatus: 1 });
        }
        continue;
      }

      if (debeEstarActivo && !relacionExistente) {
        await repo.save(
          repo.create({
            idGeocerca,
            idUsuario,
            estatus: 1,
          }),
        );
        continue;
      }

      if (!debeEstarActivo && relacionExistente && Number(relacionExistente.estatus) === 1) {
        await repo.update(relacionExistente.id, { estatus: 0 });
      }
    }
  }

  private async resolveIdClienteCreate(
    rol: number,
    idClienteToken: number,
    idClienteDto?: number,
  ): Promise<number> {
    if (this.esRolClienteFijo(rol)) {
      return Number(idClienteToken);
    }

    if (idClienteDto == null) {
      throw new BadRequestException('idCliente es obligatorio');
    }

    await this.assertClienteExiste(idClienteDto);
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteDto)) {
      throw new ForbiddenException(
        'No puedes crear geocercas para ese cliente',
      );
    }
    return Number(idClienteDto);
  }

  private async resolveIdClienteUpdate(
    rol: number,
    idClienteToken: number,
    idClienteActual: number,
    idClienteDto?: number,
  ): Promise<number> {
    if (idClienteDto === undefined) {
      return Number(idClienteActual);
    }

    if (this.esRolClienteFijo(rol)) {
      return Number(idClienteToken);
    }

    await this.assertClienteExiste(idClienteDto);
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteDto)) {
      throw new ForbiddenException(
        'No puedes reasignar la geocerca a ese cliente',
      );
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
      const idInstalacion = await this.assertInstalacionDelCliente(
        idCliente,
        dto.idInstalacion,
      );
      const usuariosIds = await this.resolveUsuariosIdsCreate(
        rol,
        idUser,
        idCliente,
        dto.usuariosIds,
      );

      const geocercaRepo = queryRunner.manager.getRepository(Geocercas);
      const ugRepo = queryRunner.manager.getRepository(UsuariosGeocerca);

      const entity = geocercaRepo.create({
        idCliente,
        idInstalacion,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        geocerca: dto.geocerca,
        estatus: EstatusEnum.ACTIVO,
      });

      const saved = await geocercaRepo.save(entity);

      await ugRepo.save(
        usuariosIds.map((idUsuario) =>
          ugRepo.create({
            idGeocerca: Number(saved.id),
            idUsuario,
            estatus: 1,
          }),
        ),
      );

      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Geocercas',
        `Se creó la geocerca ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente, usuariosIds },
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
        const scope = await this.tenantFilter.idsClientePermitidos(
          rol,
          idClienteToken,
        );
        if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteFiltro)) {
          return { data: [] };
        }
        idClienteWhere = idClienteFiltro;
      }

      const where: FindOptionsWhere<Geocercas> = {
        estatus: EstatusEnum.ACTIVO,
        ...(idClienteWhere !== undefined
          ? { idCliente: idClienteWhere }
          : {}),
      };

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_GEOCERCA],
        order: { id: 'ASC' },
      });

      return { data: data.map((item) => mapGeocercaPlano(item)) };
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
        data: data.map((item) => mapGeocercaPlano(item)),
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
    return { data: mapGeocercaPlano(entity) };
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

      let idInstalacion: number | null =
        entity.idInstalacion != null ? Number(entity.idInstalacion) : null;

      if (dto.idInstalacion !== undefined) {
        idInstalacion = await this.assertInstalacionDelCliente(
          idCliente,
          dto.idInstalacion,
        );
      } else if (idClienteAnterior !== idCliente && idInstalacion != null) {
        idInstalacion = await this.assertInstalacionDelCliente(
          idCliente,
          idInstalacion,
        );
      }

      let usuariosIdsSync: number[] | undefined;
      if (Array.isArray(dto.usuariosIds)) {
        usuariosIdsSync = await this.assertUsuariosDelCliente(
          idCliente,
          dto.usuariosIds,
        );
      }

      const geocercaRepo = queryRunner.manager.getRepository(Geocercas);
      const ugRepo = queryRunner.manager.getRepository(UsuariosGeocerca);

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
      if (dto.idInstalacion !== undefined || idClienteAnterior !== idCliente) {
        entity.idInstalacion = idInstalacion;
      }

      const saved = await geocercaRepo.save(entity);

      if (usuariosIdsSync !== undefined) {
        await this.sincronizarUsuariosGeocerca(
          ugRepo,
          Number(saved.id),
          usuariosIdsSync,
        );
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

      // UsuariosGeocerca se elimina en cascada por FK
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

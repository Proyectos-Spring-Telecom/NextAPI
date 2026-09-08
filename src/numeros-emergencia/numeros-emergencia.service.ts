import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { NumerosEmergenciaCliente } from 'src/entities/NumerosEmergenciaCliente';
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
import { CreateNumeroEmergenciaDto } from './dto/create-numero-emergencia.dto';
import { UpdateNumeroEmergenciaDto } from './dto/update-numero-emergencia.dto';
import {
  mapNumeroEmergenciaPlano,
  RELACIONES_NUMERO_EMERGENCIA,
} from './map-numeros-emergencia.util';

@Injectable()
export class NumerosEmergenciaService {
  constructor(
    @InjectRepository(NumerosEmergenciaCliente)
    private readonly repository: Repository<NumerosEmergenciaCliente>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
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
        'No puedes crear números de emergencia para ese cliente',
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
        'No puedes reasignar el número de emergencia a ese cliente',
      );
    }
    return Number(idClienteDto);
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

  private async findVisibleOrFail(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<NumerosEmergenciaCliente> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('Número de emergencia no encontrado');
    }

    const where: FindOptionsWhere<NumerosEmergenciaCliente> = {
      id,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    const entity = await this.repository.findOne({
      where,
      relations: [...RELACIONES_NUMERO_EMERGENCIA],
    });
    if (!entity) {
      throw new NotFoundException('Número de emergencia no encontrado');
    }
    return entity;
  }

  async create(
    dto: CreateNumeroEmergenciaDto,
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

      const entity = this.repository.create({
        idCliente,
        nombre: dto.nombre?.trim() || null,
        telefono: dto.telefono.trim(),
        descripcion: dto.descripcion?.trim() || null,
        prioridad: dto.prioridad != null ? Number(dto.prioridad) : 1,
        estatus: EstatusEnum.ACTIVO,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'NumerosEmergenciaCliente',
        `Se creó el número de emergencia ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Número de emergencia creado correctamente',
        data: {
          id: Number(saved.id),
          nombre: saved.nombre ?? saved.telefono,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'NumerosEmergenciaCliente',
        'Error al crear número de emergencia',
        'CREATE',
        { dto },
        idUser,
        EnumModulos.CLIENTES,
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

      const where: FindOptionsWhere<NumerosEmergenciaCliente> = {
        estatus: EstatusEnum.ACTIVO,
        ...(idClienteWhere !== undefined
          ? { idCliente: idClienteWhere }
          : {}),
      };

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_NUMERO_EMERGENCIA],
        order: { prioridad: 'ASC', id: 'ASC' },
      });

      return { data: data.map((item) => mapNumeroEmergenciaPlano(item)) };
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

      const where: FindOptionsWhere<NumerosEmergenciaCliente> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };

      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_NUMERO_EMERGENCIA],
        skip: (page - 1) * limit,
        take: limit,
        order: { prioridad: 'ASC', id: 'ASC' },
      });

      return {
        data: data.map((item) => mapNumeroEmergenciaPlano(item)),
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

  async findByIdCliente(
    idCliente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      await this.assertClienteExiste(idCliente);
      await this.assertClienteEnAlcance(idCliente, idClienteToken, rol);

      const data = await this.repository.find({
        where: {
          idCliente,
          estatus: EstatusEnum.ACTIVO,
        },
        relations: [...RELACIONES_NUMERO_EMERGENCIA],
        order: { prioridad: 'ASC', id: 'ASC' },
      });

      return { data: data.map((item) => mapNumeroEmergenciaPlano(item)) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: ReturnType<typeof mapNumeroEmergenciaPlano> }> {
    const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
    return { data: mapNumeroEmergenciaPlano(entity) };
  }

  async update(
    id: number,
    dto: UpdateNumeroEmergenciaDto,
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
        entity.nombre = dto.nombre?.trim() || null;
      }
      if (dto.telefono !== undefined) {
        entity.telefono = dto.telefono.trim();
      }
      if (dto.descripcion !== undefined) {
        entity.descripcion = dto.descripcion?.trim() || null;
      }
      if (dto.prioridad !== undefined) {
        entity.prioridad = Number(dto.prioridad);
      }
      entity.idCliente = idCliente;

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'NumerosEmergenciaCliente',
        `Se actualizó el número de emergencia ID: ${saved.id}`,
        'UPDATE',
        { dto, idCliente },
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Número de emergencia actualizado correctamente',
        data: {
          id: Number(saved.id),
          nombre: saved.nombre ?? saved.telefono,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'NumerosEmergenciaCliente',
        `Error al actualizar número de emergencia ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.CLIENTES,
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
        'NumerosEmergenciaCliente',
        `Se cambió estatus del número de emergencia ID: ${saved.id} → ${estatus}`,
        'UPDATE',
        { estatusAnterior, estatus },
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: {
          id: Number(saved.id),
          nombre: saved.nombre ?? saved.telefono,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'NumerosEmergenciaCliente',
        `Error al cambiar estatus del número de emergencia ID: ${id}`,
        'UPDATE',
        {},
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}

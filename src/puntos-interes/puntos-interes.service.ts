import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PuntosInteres } from 'src/entities/PuntosInteres';
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
        'No puedes crear puntos de interés para ese cliente',
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
        'No puedes reasignar el punto de interés a ese cliente',
      );
    }
    return Number(idClienteDto);
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

      const entity = this.repository.create({
        idCliente,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        lng: dto.lng,
        lat: dto.lat,
        icono: dto.icono?.trim() || null,
        estatus: EstatusEnum.ACTIVO,
      });

      const saved = await this.repository.save(entity);

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

      const where: FindOptionsWhere<PuntosInteres> = {
        estatus: EstatusEnum.ACTIVO,
        ...(idClienteWhere !== undefined
          ? { idCliente: idClienteWhere }
          : {}),
      };

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_PUNTO_INTERES],
        order: { id: 'ASC' },
      });

      return { data: data.map((item) => mapPuntoInteresPlano(item)) };
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
        data: data.map((item) => mapPuntoInteresPlano(item)),
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
  ): Promise<{ data: ReturnType<typeof mapPuntoInteresPlano> }> {
    const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
    return { data: mapPuntoInteresPlano(entity) };
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
      if (dto.icono !== undefined) {
        entity.icono = dto.icono?.trim() || null;
      }
      entity.idCliente = idCliente;

      const saved = await this.repository.save(entity);

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

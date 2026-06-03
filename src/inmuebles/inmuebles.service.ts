import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Inmuebles } from 'src/entities/Inmuebles';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateInmueblesDto } from './dto/create-inmuebles.dto';
import { UpdateInmueblesDto } from './dto/update-inmuebles.dto';
import { UpdateInmueblesEstatusDto } from './dto/update-inmuebles-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumModulos } from 'src/common/estatus.enum';

@Injectable()
export class InmueblesService {
  constructor(
    @InjectRepository(Inmuebles)
    private readonly repository: Repository<Inmuebles>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private nombreDisplay(entity: Inmuebles): string {
    return entity.inmueble?.trim() || `Inmueble ${entity.id}`;
  }

  async create(
    dto: CreateInmueblesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = this.repository.create({
        inmueble: dto.inmueble ?? null,
        idCliente,
        direccionFiscal: dto.direccionFiscal ?? null,
        vigenciaAnios: dto.vigenciaAnios ?? null,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        nombreRepresentante: dto.nombreRepresentante ?? null,
        telefonoRepresentante: dto.telefonoRepresentante ?? null,
        correoRepresentante: dto.correoRepresentante ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        mapaInmueble: dto.mapaInmueble ?? null,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Se creó el inmueble: ${this.nombreDisplay(saved)}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Inmueble creado correctamente',
        data: { id: Number(saved.id), nombre: this.nombreDisplay(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Error al crear inmueble`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
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
      const where: FindOptionsWhere<Inmuebles> = {
        estatus: 1,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        order: { id: 'DESC' },
      });
      return {
        data: data.map((item) => ({ ...item, id: Number(item.id) })),
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const where: FindOptionsWhere<Inmuebles> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      return {
        data: data.map((item) => ({ ...item, id: Number(item.id) })),
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(
    id: number,
    idCliente: number,
  ): Promise<{ data: Inmuebles }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el inmueble' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateInmueblesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }

      const updateData: Partial<Inmuebles> = {};
      if (dto.inmueble !== undefined) updateData.inmueble = dto.inmueble;
      if (dto.direccionFiscal !== undefined)
        updateData.direccionFiscal = dto.direccionFiscal;
      if (dto.vigenciaAnios !== undefined)
        updateData.vigenciaAnios = dto.vigenciaAnios;
      if (dto.fechaInicio !== undefined)
        updateData.fechaInicio = dto.fechaInicio
          ? new Date(dto.fechaInicio)
          : null;
      if (dto.fechaFin !== undefined)
        updateData.fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : null;
      if (dto.nombreRepresentante !== undefined)
        updateData.nombreRepresentante = dto.nombreRepresentante;
      if (dto.telefonoRepresentante !== undefined)
        updateData.telefonoRepresentante = dto.telefonoRepresentante;
      if (dto.correoRepresentante !== undefined)
        updateData.correoRepresentante = dto.correoRepresentante;
      if (dto.lat !== undefined) updateData.lat = dto.lat;
      if (dto.lng !== undefined) updateData.lng = dto.lng;
      if (dto.mapaInmueble !== undefined)
        updateData.mapaInmueble = dto.mapaInmueble;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      Object.assign(entity, updateData);
      await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Se actualizó el inmueble ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Inmueble actualizado correctamente',
        data: {
          id,
          nombre: this.nombreDisplay(updated ?? entity),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Error al actualizar inmueble ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateInmueblesEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }

      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Se actualizó estatus de inmueble ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: this.nombreDisplay(entity) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Error al actualizar estatus de inmueble ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del inmueble',
      );
    }
  }
}

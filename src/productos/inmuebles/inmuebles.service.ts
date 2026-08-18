import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Productos } from 'src/entities/Productos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateInmueblesDto } from './dto/create-inmuebles.dto';
import { UpdateInmueblesDto } from './dto/update-inmuebles.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumModulos,
  EnumTipoProducto,
} from 'src/common/estatus.enum';
import { crearProductoBase } from '../crear-producto.util';
import {
  nombreCliente,
  RELACIONES_DETALLE_PRODUCTO,
} from '../map-relaciones.util';

@Injectable()
export class InmueblesService {
  constructor(
    @InjectRepository(Inmuebles)
    private readonly repository: Repository<Inmuebles>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private nombreDisplay(entity: Inmuebles): string {
    return entity.inmueble?.trim() || `Inmueble ${entity.idProducto}`;
  }

  private mapInmueble(item: Inmuebles) {
    const producto = item.idProducto2;
    const cliente = producto?.idCliente2;
    const tipoProducto = producto?.idTipoProducto2;

    return {
      id: Number(item.idProducto),
      nombreInmueble: item.inmueble,
      direccionFiscal: item.direccionFiscal,
      nombreRepresentante: item.nombreRepresentante,
      telefonoRepresentante: item.telefonoRepresentante,
      correoRepresentante: item.correoRepresentante,
      lat: item.lat != null ? Number(item.lat) : null,
      lng: item.lng != null ? Number(item.lng) : null,
      nombreProducto: producto?.nombre ?? item.inmueble,
      estatus: producto?.estatus != null ? Number(producto.estatus) : null,
      idCliente: Number(item.idCliente),
      nombreCliente: nombreCliente(cliente),
      idTipoProducto:
        tipoProducto?.id != null ? Number(tipoProducto.id) : null,
      nombreTipoProducto: tipoProducto?.nombre ?? null,
      codigoTipoProducto: tipoProducto?.codigo ?? null,
      fechaCreacion: producto?.fechaCreacion ?? null,
      fechaActualizacion: producto?.fechaActualizacion ?? null,
    };
  }

  async create(
    dto: CreateInmueblesDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const producto = await crearProductoBase(queryRunner.manager, {
        idCliente,
        idTipoProducto: EnumTipoProducto.INMUEBLE,
        nombre: dto.inmueble?.trim() || null,
      });

      const entity = queryRunner.manager.create(Inmuebles, {
        idProducto: producto.id,
        inmueble: dto.inmueble ?? null,
        idCliente,
        direccionFiscal: dto.direccionFiscal ?? null,
        nombreRepresentante: dto.nombreRepresentante ?? null,
        telefonoRepresentante: dto.telefonoRepresentante ?? null,
        correoRepresentante: dto.correoRepresentante ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
      });

      const saved = await queryRunner.manager.save(entity);
      await queryRunner.commitTransaction();

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
        data: {
          id: Number(saved.idProducto),
          nombre: this.nombreDisplay(saved),
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
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
    } finally {
      await queryRunner.release();
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
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_PRODUCTO,
        order: { idProducto: 'DESC' },
      });
      return {
        data: data.map((item) => this.mapInmueble(item)),
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
        relations: RELACIONES_DETALLE_PRODUCTO,
        skip: (page - 1) * limit,
        take: limit,
        order: { idProducto: 'DESC' },
      });
      return {
        data: data.map((item) => this.mapInmueble(item)),
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

  async findOne(id: number, idCliente: number) {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id },
        relations: RELACIONES_DETALLE_PRODUCTO,
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }
      return {
        data: this.mapInmueble(entity),
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
        where: { idProducto: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }

      const updateData: Partial<Inmuebles> = {};
      if (dto.inmueble !== undefined) updateData.inmueble = dto.inmueble;
      if (dto.direccionFiscal !== undefined)
        updateData.direccionFiscal = dto.direccionFiscal;
      if (dto.nombreRepresentante !== undefined)
        updateData.nombreRepresentante = dto.nombreRepresentante;
      if (dto.telefonoRepresentante !== undefined)
        updateData.telefonoRepresentante = dto.telefonoRepresentante;
      if (dto.correoRepresentante !== undefined)
        updateData.correoRepresentante = dto.correoRepresentante;
      if (dto.lat !== undefined) updateData.lat = dto.lat;
      if (dto.lng !== undefined) updateData.lng = dto.lng;

      Object.assign(entity, updateData);
      await this.repository.save(entity);

      if (dto.inmueble !== undefined) {
        await this.productosRepo.update(
          { id, idCliente },
          { nombre: dto.inmueble },
        );
      }

      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Se actualizó el inmueble ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({
        where: { idProducto: id },
      });
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
    dto: UpdateProductoEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Inmueble no encontrado');
      }
      const producto = await this.productosRepo.findOne({
        where: { id, idCliente },
      });
      if (!producto) {
        throw new NotFoundException('Producto del inmueble no encontrado');
      }

      const estatusAnterior = Number(producto.estatus);
      const estatus = dto.estatus;
      await this.productosRepo.update({ id, idCliente }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Inmuebles',
        `Se actualizó estatus de inmueble ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.INMUEBLES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
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
      throw new BadRequestException((error as Error)?.message);
    }
  }
}

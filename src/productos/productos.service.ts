import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Productos } from 'src/entities/Productos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdateProductosDto } from './dto/update-productos.dto';
import { UpdateProductoEstatusDto } from './dto/update-producto-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumModulos } from 'src/common/estatus.enum';
import {
  mapClienteRelacion,
  mapTipoProductoRelacion,
  RELACIONES_PRODUCTO_BASE,
} from './map-relaciones.util';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Productos)
    private readonly repository: Repository<Productos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private mapProducto(item: Productos) {
    const { idCliente2, idTipoProducto2, ...producto } = item;
    return {
      ...producto,
      id: Number(item.id),
      idCliente: Number(item.idCliente),
      idTipoProducto: Number(item.idTipoProducto),
      cliente: mapClienteRelacion(idCliente2),
      tipoProducto: mapTipoProductoRelacion(idTipoProducto2),
    };
  }

  private async whereTenant(
    rol: number,
    idClienteToken: number,
    idTipoProducto?: number,
    idClienteFiltro?: number,
  ): Promise<{ sinAcceso: boolean; where: FindOptionsWhere<Productos> }> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return { sinAcceso: true, where: {} };
    }

    let idClienteWhere = tenant.idCliente;
    if (idClienteFiltro != null) {
      if (tenant.idCliente === undefined) {
        idClienteWhere = idClienteFiltro;
      } else if (typeof tenant.idCliente === 'number') {
        if (Number(tenant.idCliente) !== idClienteFiltro) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      } else {
        const ids = await this.tenantFilter.getClienteHijosIds(idClienteToken);
        if (!ids.includes(idClienteFiltro)) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      }
    }

    return {
      sinAcceso: false,
      where: {
        ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
        ...(idTipoProducto != null ? { idTipoProducto } : {}),
      },
    };
  }

  async findAllList(
    idCliente: number,
    rol: number,
    idTipoProducto?: number,
    idClienteFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoProducto,
        idClienteFiltro,
      );
      if (sinAcceso) {
        return { data: [] };
      }
      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_PRODUCTO_BASE],
        order: { id: 'DESC' },
      });
      return { data: data.map((item) => this.mapProducto(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
    idTipoProducto?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoProducto,
      );
      if (sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_PRODUCTO_BASE],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      return {
        data: data.map((item) => this.mapProducto(item)),
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
        where: { id },
        relations: [...RELACIONES_PRODUCTO_BASE],
      });
      if (!entity) {
        throw new NotFoundException('Producto no encontrado');
      }
      return { data: this.mapProducto(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdateProductosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Producto no encontrado');
      }
      if (dto.nombre !== undefined) {
        entity.nombre = dto.nombre;
      }
      await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Productos',
        `Se actualizó el producto ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.MODULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Producto actualizado correctamente',
        data: {
          id,
          nombre: entity.nombre ?? `Producto ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Productos',
        `Error al actualizar producto ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.MODULOS,
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
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Producto no encontrado');
      }

      const estatusAnterior = Number(entity.estatus);
      const estatus = dto.estatus;
      await this.repository.update({ id, idCliente }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Productos',
        `Se actualizó estatus de producto ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.MODULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: {
          id,
          nombre: entity.nombre ?? `Producto ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Productos',
        `Error al actualizar estatus de producto ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.MODULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del producto',
      );
    }
  }
}

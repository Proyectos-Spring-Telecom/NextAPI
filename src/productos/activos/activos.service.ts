import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
import { Activos } from 'src/entities/Activos';
import { Productos } from 'src/entities/Productos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateActivosDto } from './dto/create-activos.dto';
import { UpdateActivosDto } from './dto/update-activos.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';
import { crearProductoBase } from '../crear-producto.util';
import {
  nombreCliente,
  RELACIONES_DETALLE_PRODUCTO,
} from '../map-relaciones.util';

@Injectable()
export class ActivosService {
  constructor(
    @InjectRepository(Activos)
    private readonly repository: Repository<Activos>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private nombreDisplay(entity: Activos): string {
    return entity.nombre?.trim() || `Activo ${entity.idProducto}`;
  }

  private mapActivo(item: Activos) {
    const producto = item.idProducto2;
    const cliente = producto?.idCliente2;
    const tipoProducto = producto?.idTipoProducto2;
    const idProducto = Number(item.idProducto);

    return {
      id: idProducto,
      nombreActivo: item.nombre,
      descripcionActivo: item.descripcion,
      nombreProducto: producto?.nombre ?? item.nombre,
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
    dto: CreateActivosDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const producto = await crearProductoBase(queryRunner.manager, {
        idCliente,
        idTipoProducto: EnumTipoProducto.ACTIVO,
        nombre: dto.nombre,
      });

      const entity = queryRunner.manager.create(Activos, {
        idProducto: producto.id,
        idCliente,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
      });
      const saved = await queryRunner.manager.save(entity);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Activos',
        `Se creó el activo: ${this.nombreDisplay(saved)}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.ACTIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Activo creado correctamente',
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
        'Activos',
        'Error al crear activo',
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.ACTIVOS,
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
      const where: FindOptionsWhere<Activos> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_PRODUCTO,
        order: { idProducto: 'DESC' },
      });
      return { data: data.map((item) => this.mapActivo(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
    obtenerTodos?: EstatusEnum,
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
      const incluirInservibles = obtenerTodos === EstatusEnum.ACTIVO;
      const where: FindOptionsWhere<Activos> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
        ...(incluirInservibles
          ? {}
          : {
              idProducto2: {
                estatus: Not(EnumEstatusProductoDispositivo.INSERVIBLE),
              },
            }),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: RELACIONES_DETALLE_PRODUCTO,
        skip: (page - 1) * limit,
        take: limit,
        order: { idProducto: 'DESC' },
      });
      return {
        data: data.map((item) => this.mapActivo(item)),
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
        throw new NotFoundException('Activo no encontrado');
      }
      return { data: this.mapActivo(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdateActivosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Activo no encontrado');
      }

      if (dto.nombre !== undefined) entity.nombre = dto.nombre;
      if (dto.descripcion !== undefined) entity.descripcion = dto.descripcion;
      await this.repository.save(entity);

      if (dto.nombre !== undefined) {
        await this.productosRepo.update(
          { id, idCliente },
          { nombre: dto.nombre },
        );
      }

      await this.bitacoraLogger.logToBitacora(
        'Activos',
        `Se actualizó el activo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.ACTIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Activo actualizado correctamente',
        data: {
          id,
          nombre: this.nombreDisplay(entity),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Activos',
        `Error al actualizar activo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.ACTIVOS,
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
        where: { idProducto: id },
      });
      if (!entity) {
        throw new NotFoundException('Activo no encontrado');
      }
      const producto = await this.productosRepo.findOne({
        where: { id },
      });
      if (!producto) {
        throw new NotFoundException('Producto del activo no encontrado');
      }

      assertEstatusNoAsignado(Number(producto.estatus), 'producto');

      const estatusAnterior = Number(producto.estatus);
      const estatus = dto.estatus;
      await this.productosRepo.update({ id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Activos',
        `Se actualizó estatus de activo ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
        idUser,
        EnumModulos.ACTIVOS,
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
        'Activos',
        `Error al actualizar estatus de activo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.ACTIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del activo',
      );
    }
  }
}

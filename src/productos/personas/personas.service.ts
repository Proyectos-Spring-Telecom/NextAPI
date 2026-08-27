import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Personas } from 'src/entities/Personas';
import { Productos } from 'src/entities/Productos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreatePersonasDto } from './dto/create-personas.dto';
import { UpdatePersonasDto } from './dto/update-personas.dto';
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
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';
import { crearProductoBase } from '../crear-producto.util';
import {
  nombreCliente,
  RELACIONES_DETALLE_PRODUCTO,
} from '../map-relaciones.util';

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Personas)
    private readonly repository: Repository<Personas>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private nombreDisplay(entity: Personas): string {
    return entity.nombre?.trim() || `Persona ${entity.idProducto}`;
  }

  private mapPersona(item: Personas) {
    const producto = item.idProducto2;
    const cliente = producto?.idCliente2;
    const tipoProducto = producto?.idTipoProducto2;

    return {
      id: Number(item.idProducto),
      nombrePersona: item.nombre,
      telefonoPersona: item.telefono,
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
    dto: CreatePersonasDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const producto = await crearProductoBase(queryRunner.manager, {
        idCliente,
        idTipoProducto: EnumTipoProducto.PERSONA,
        nombre: dto.nombre,
      });

      const entity = queryRunner.manager.create(Personas, {
        idProducto: producto.id,
        idCliente,
        nombre: dto.nombre,
        telefono: dto.telefono ?? null,
      });
      const saved = await queryRunner.manager.save(entity);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Personas',
        `Se creó la persona: ${this.nombreDisplay(saved)}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PERSONAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Persona creada correctamente',
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
        'Personas',
        'Error al crear persona',
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PERSONAS,
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
      const where: FindOptionsWhere<Personas> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_PRODUCTO,
        order: { idProducto: 'DESC' },
      });
      return { data: data.map((item) => this.mapPersona(item)) };
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
      const where: FindOptionsWhere<Personas> = {
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
        data: data.map((item) => this.mapPersona(item)),
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
        throw new NotFoundException('Persona no encontrada');
      }
      return { data: this.mapPersona(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdatePersonasDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Persona no encontrada');
      }

      if (dto.nombre !== undefined) entity.nombre = dto.nombre;
      if (dto.telefono !== undefined) entity.telefono = dto.telefono;
      await this.repository.save(entity);

      if (dto.nombre !== undefined) {
        await this.productosRepo.update(
          { id, idCliente },
          { nombre: dto.nombre },
        );
      }

      await this.bitacoraLogger.logToBitacora(
        'Personas',
        `Se actualizó la persona ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PERSONAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Persona actualizada correctamente',
        data: {
          id,
          nombre: this.nombreDisplay(entity),
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Personas',
        `Error al actualizar persona ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PERSONAS,
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
        throw new NotFoundException('Persona no encontrada');
      }
      const producto = await this.productosRepo.findOne({
        where: { id },
      });
      if (!producto) {
        throw new NotFoundException('Producto de la persona no encontrado');
      }

      assertEstatusNoAsignado(Number(producto.estatus), 'producto');

      const estatusAnterior = Number(producto.estatus);
      const estatus = dto.estatus;
      await this.productosRepo.update({ id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Personas',
        `Se actualizó estatus de persona ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
        idUser,
        EnumModulos.PERSONAS,
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
        'Personas',
        `Error al actualizar estatus de persona ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PERSONAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus de la persona',
      );
    }
  }
}

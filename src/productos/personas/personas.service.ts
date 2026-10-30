import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
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
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { MotorActivosService } from 'src/motor-activos/motor-activos.service';
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
    private readonly motor: MotorActivosService,
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

  /**
   * La persona es de un cliente del alcance del usuario; si no, 404 con el mismo
   * mensaje que cuando no existe (no se revela que existe).
   */
  private async assertPersonaVisible(
    alcance: UsuarioAlcance,
    idCliente: number,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      alcance.rol,
      alcance.idCliente,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new NotFoundException('Persona no encontrada');
    }
  }

  async create(
    dto: CreatePersonasDto,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Solo se da de alta en un cliente del alcance de quien crea (403 si no).
      await this.tenantFilter.assertClienteDestino(alcance, idCliente);
      const producto = await crearProductoBase(queryRunner.manager, {
        idCliente,
        idUsuario: idUser,
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
      const where: FindOptionsWhere<Personas> = {
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

  async findOne(id: number, alcance: UsuarioAlcance) {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id },
        relations: RELACIONES_DETALLE_PRODUCTO,
      });
      if (!entity) {
        throw new NotFoundException('Persona no encontrada');
      }
      // Fuera del alcance del usuario → 404 (no se revela que existe).
      await this.assertPersonaVisible(alcance, Number(entity.idCliente));
      return { data: this.mapPersona(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdatePersonasDto,
    alcance: UsuarioAlcance,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = alcance.idCliente;
    try {
      // Se busca por id (no por el cliente del token) y se valida el alcance sobre
      // el cliente del registro: administración y padres editan lo de sus hijos.
      const entity = await this.repository.findOne({
        where: { idProducto: id },
      });
      if (!entity) {
        throw new NotFoundException('Persona no encontrada');
      }
      await this.assertPersonaVisible(alcance, Number(entity.idCliente));

      if (dto.nombre !== undefined) entity.nombre = dto.nombre;
      if (dto.telefono !== undefined) entity.telefono = dto.telefono;
      await this.repository.save(entity);

      if (dto.nombre !== undefined) {
        await this.productosRepo.update(
          { id, idCliente: entity.idCliente },
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
    alcance: UsuarioAlcance,
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

      // Solo recursos del alcance del usuario (404 si no); la transición la valida el motor (§1).
      await this.tenantFilter.assertClienteVisible(alcance, Number(producto.idCliente), 'Recurso');

      const estatusAnterior = Number(producto.estatus);
      const estatus = dto.estatus;
      await this.motor.cambiarEstatusManual('producto', producto, estatus, {
        idUsuario: idUser,
        rol: alcance.rol,
        motivo: dto.motivo,
      });

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

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Vehiculos } from 'src/entities/Vehiculos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateHistoricoInstalacionesDto } from './dto/create-historico-instalaciones.dto';
import { UpdateHistoricoInstalacionesDto } from './dto/update-historico-instalaciones.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_INSTALACIONES = 17;

@Injectable()
export class HistoricoInstalacionesService {
  constructor(
    @InjectRepository(HistoricoInstalaciones)
    private readonly repository: Repository<HistoricoInstalaciones>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Vehiculos)
    private readonly vehiculosRepo: Repository<Vehiculos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarFks(
    idCliente: number,
    dto: {
      idInstalacion?: number | null;
      idDispositivo?: number | null;
      idVehiculo?: number;
    },
  ): Promise<void> {
    if (dto.idVehiculo !== undefined) {
      const vehiculo = await this.vehiculosRepo.findOne({
        where: { id: dto.idVehiculo, idCliente },
      });
      if (!vehiculo) {
        throw new BadRequestException(
          'IdVehiculo no existe o no pertenece al cliente',
        );
      }
    }

    if (dto.idDispositivo != null) {
      const dispositivo = await this.dispositivosRepo.findOne({
        where: { id: dto.idDispositivo, idCliente },
      });
      if (!dispositivo) {
        throw new BadRequestException(
          'IdDispositivo no existe o no pertenece al cliente',
        );
      }
    }

    if (dto.idInstalacion != null) {
      const instalacion = await this.instalacionesRepo.findOne({
        where: { id: dto.idInstalacion, idCliente },
      });
      if (!instalacion) {
        throw new BadRequestException(
          'IdInstalacion no existe o no pertenece al cliente',
        );
      }
    }
  }

  async create(
    dto: CreateHistoricoInstalacionesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      await this.validarFks(idCliente, {
        idInstalacion: dto.idInstalacion,
        idDispositivo: dto.idDispositivo,
        idVehiculo: dto.idVehiculo,
      });

      const entity = this.repository.create({
        idInstalacion: dto.idInstalacion ?? null,
        idDispositivo: dto.idDispositivo ?? null,
        idVehiculo: dto.idVehiculo,
        idActivos: dto.idActivos ?? null,
        idPortatiles: dto.idPortatiles ?? null,
        estatusInstalacion: dto.estatusInstalacion,
        accion: dto.accion,
        comentario: dto.comentario ?? null,
        idCliente,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Se registró histórico de instalación ID: ${saved.id} (${dto.accion})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Registro histórico creado correctamente',
        data: {
          id: Number(saved.id),
          nombre: `Histórico ${saved.id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Error al crear histórico de instalación (${dto.accion})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
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
      const where: FindOptionsWhere<HistoricoInstalaciones> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        order: { fechaRegistro: 'DESC', id: 'DESC' },
      });
      return {
        data: data.map((item) => ({
          ...item,
          id: Number(item.id),
        })),
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
          paginated: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
      const where: FindOptionsWhere<HistoricoInstalaciones> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaRegistro: 'DESC', id: 'DESC' },
      });
      return {
        data: data.map((item) => ({
          ...item,
          id: Number(item.id),
        })),
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
  ): Promise<{ data: HistoricoInstalaciones }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Registro histórico no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el registro histórico' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateHistoricoInstalacionesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Registro histórico no encontrado');
      }

      await this.validarFks(idCliente, {
        idInstalacion:
          dto.idInstalacion !== undefined
            ? dto.idInstalacion
            : entity.idInstalacion,
        idDispositivo:
          dto.idDispositivo !== undefined
            ? dto.idDispositivo
            : entity.idDispositivo,
        idVehiculo: dto.idVehiculo ?? entity.idVehiculo,
      });

      const updateData: Partial<HistoricoInstalaciones> = {};
      if (dto.idInstalacion !== undefined)
        updateData.idInstalacion = dto.idInstalacion;
      if (dto.idDispositivo !== undefined)
        updateData.idDispositivo = dto.idDispositivo;
      if (dto.idVehiculo !== undefined) updateData.idVehiculo = dto.idVehiculo;
      if (dto.idActivos !== undefined) updateData.idActivos = dto.idActivos;
      if (dto.idPortatiles !== undefined)
        updateData.idPortatiles = dto.idPortatiles;
      if (dto.estatusInstalacion !== undefined)
        updateData.estatusInstalacion = dto.estatusInstalacion;
      if (dto.accion !== undefined) updateData.accion = dto.accion;
      if (dto.comentario !== undefined) updateData.comentario = dto.comentario;

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Se actualizó histórico de instalación ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Registro histórico actualizado correctamente',
        data: { id, nombre: `Histórico ${id}` },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Error al actualizar histórico de instalación ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}

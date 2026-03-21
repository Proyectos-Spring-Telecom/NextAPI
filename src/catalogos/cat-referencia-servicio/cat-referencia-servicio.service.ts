import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatReferenciaServicio } from 'src/entities/CatReferenciaServicio';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatReferenciaServicioDto } from './dto/create-cat-referencia-servicio.dto';
import { UpdateCatReferenciaServicioDto } from './dto/update-cat-referencia-servicio.dto';
import { UpdateCatReferenciaServicioEstatusDto } from './dto/update-cat-referencia-servicio-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

// Configurar según el módulo que consuma este catálogo. Revisar tabla Modulos en BD.
const ID_MODULO_REFERENCIA_SERVICIO = 20;

@Injectable()
export class CatReferenciaServicioService {
  constructor(
    @InjectRepository(CatReferenciaServicio)
    private readonly repository: Repository<CatReferenciaServicio>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatReferenciaServicioDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Se creó la referencia de servicio: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Referencia de servicio creada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Error al crear referencia de servicio: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(soloActivos = true): Promise<ApiResponseCommon> {
    try {
      const where = soloActivos ? { estatus: 1 } : {};
      const data = await this.repository.find({
        where,
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return { data: dataNormalizada };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    page: number,
    limit: number,
    soloActivos = false,
  ): Promise<ApiResponseCommon> {
    try {
      const where = soloActivos ? { estatus: 1 } : {};
      const [data, total] = await this.repository.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return {
        data: dataNormalizada,
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

  async findOne(id: number): Promise<{ data: CatReferenciaServicio }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Referencia de servicio no encontrada');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar la referencia de servicio' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatReferenciaServicioDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Referencia de servicio no encontrada');
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Se actualizó la referencia de servicio ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Referencia de servicio actualizada correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Error al actualizar referencia de servicio ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatReferenciaServicioEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Referencia de servicio no encontrada');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Se actualizó estatus de referencia de servicio ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatReferenciaServicio',
        `Error al actualizar estatus de referencia de servicio ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_REFERENCIA_SERVICIO,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus de la referencia de servicio`,
      );
    }
  }
}

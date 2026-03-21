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
import { CatTipoAlerta } from 'src/entities/CatTipoAlerta';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatTipoAlertaDto } from './dto/create-cat-tipo-alerta.dto';
import { UpdateCatTipoAlertaDto } from './dto/update-cat-tipo-alerta.dto';
import { UpdateCatTipoAlertaEstatusDto } from './dto/update-cat-tipo-alerta-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

// Configurar según el módulo Alertas. Revisar tabla Modulos en BD.
const ID_MODULO_ALERTAS = 21;

@Injectable()
export class CatTipoAlertaService {
  constructor(
    @InjectRepository(CatTipoAlerta)
    private readonly repository: Repository<CatTipoAlerta>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatTipoAlertaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
        severidad: dto.severidad ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoAlerta',
        `Se creó el tipo de alerta: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_ALERTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Tipo de alerta creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoAlerta',
        `Error al crear tipo de alerta: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_ALERTAS,
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

  async findOne(id: number): Promise<{ data: CatTipoAlerta }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de alerta no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el tipo de alerta' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatTipoAlertaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de alerta no encontrado');
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoAlerta',
        `Se actualizó el tipo de alerta ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_ALERTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Tipo de alerta actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoAlerta',
        `Error al actualizar tipo de alerta ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_ALERTAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatTipoAlertaEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de alerta no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatTipoAlerta',
        `Se actualizó estatus de tipo de alerta ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_ALERTAS,
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
        'CatTipoAlerta',
        `Error al actualizar estatus de tipo de alerta ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_ALERTAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus del tipo de alerta`,
      );
    }
  }
}

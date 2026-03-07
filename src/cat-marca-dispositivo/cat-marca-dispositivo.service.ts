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
import { CatMarcaDispositivo } from 'src/entities/CatMarcaDispositivo';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatMarcaDispositivoDto } from './dto/create-cat-marca-dispositivo.dto';
import { UpdateCatMarcaDispositivoDto } from './dto/update-cat-marca-dispositivo.dto';
import { UpdateCatMarcaDispositivoEstatusDto } from './dto/update-cat-marca-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_DISPOSITIVOS = 15;

@Injectable()
export class CatMarcaDispositivoService {
  constructor(
    @InjectRepository(CatMarcaDispositivo)
    private readonly repository: Repository<CatMarcaDispositivo>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatMarcaDispositivoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existe = await this.repository.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe) {
        throw new BadRequestException('La marca de dispositivo ya existe');
      }
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatMarcaDispositivo',
        `Se creó la marca de dispositivo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Marca de dispositivo creada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatMarcaDispositivo',
        `Error al crear marca de dispositivo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
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
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(id: number): Promise<{ data: CatMarcaDispositivo }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Marca de dispositivo no encontrada');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar la marca de dispositivo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatMarcaDispositivoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Marca de dispositivo no encontrada');
      }
      if (dto.nombre && dto.nombre !== entity.nombre) {
        const existe = await this.repository.findOne({
          where: { nombre: dto.nombre },
        });
        if (existe) {
          throw new BadRequestException('La marca de dispositivo ya existe');
        }
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatMarcaDispositivo',
        `Se actualizó la marca de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Marca de dispositivo actualizada correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatMarcaDispositivo',
        `Error al actualizar marca de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatMarcaDispositivoEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Marca de dispositivo no encontrada');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatMarcaDispositivo',
        `Se actualizó estatus de marca de dispositivo ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_DISPOSITIVOS,
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
        'CatMarcaDispositivo',
        `Error al actualizar estatus de marca de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus de la marca de dispositivo`,
      );
    }
  }
}

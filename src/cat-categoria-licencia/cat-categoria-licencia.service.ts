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
import { CatCategoriaLicencia } from 'src/entities/CatCategoriaLicencia';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatCategoriaLicenciaDto } from './dto/create-cat-categoria-licencia.dto';
import { UpdateCatCategoriaLicenciaDto } from './dto/update-cat-categoria-licencia.dto';
import { UpdateCatCategoriaLicenciaEstatusDto } from './dto/update-cat-categoria-licencia-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_LICENCIAS = 19;

@Injectable()
export class CatCategoriaLicenciaService {
  constructor(
    @InjectRepository(CatCategoriaLicencia)
    private readonly repository: Repository<CatCategoriaLicencia>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatCategoriaLicenciaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existe = await this.repository.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe) {
        throw new BadRequestException('La categoría de licencia ya existe');
      }
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatCategoriaLicencia',
        `Se creó la categoría de licencia: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Categoría de licencia creada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatCategoriaLicencia',
        `Error al crear categoría de licencia: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_LICENCIAS,
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

  async findOne(id: number): Promise<{ data: CatCategoriaLicencia }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Categoría de licencia no encontrada');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar la categoría de licencia' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatCategoriaLicenciaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Categoría de licencia no encontrada');
      }
      if (dto.nombre && dto.nombre !== entity.nombre) {
        const existe = await this.repository.findOne({
          where: { nombre: dto.nombre },
        });
        if (existe) {
          throw new BadRequestException('La categoría de licencia ya existe');
        }
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatCategoriaLicencia',
        `Se actualizó la categoría de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Categoría de licencia actualizada correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatCategoriaLicencia',
        `Error al actualizar categoría de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatCategoriaLicenciaEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Categoría de licencia no encontrada');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatCategoriaLicencia',
        `Se actualizó estatus de categoría de licencia ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_LICENCIAS,
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
        'CatCategoriaLicencia',
        `Error al actualizar estatus de categoría de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus de la categoría de licencia`,
      );
    }
  }
}
